"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { runs, sessions, auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"
import { generateId, generateText } from "ai"
import { and, eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { isGameModelId, type GameModelId } from "@/lib/ai/model-catalog"
import { titleModel } from "@/lib/ai/models"
import { hasCredits } from "@/lib/credits/reconcile"
import { deleteGameSandboxes } from "@/lib/daytona/utils"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { getGame } from "@/lib/games/queries"
import { GAME_TITLE_MAX_LENGTH } from "@/lib/games/title"
import type { gameChat } from "@/trigger/chat"

const startGameChatSession =
  chat.createStartSessionAction<typeof gameChat>("game-chat")

// The chat id is the game id, and it comes from the browser: only let the
// caller chat about games in their own org. Returns that org.
async function assertCanChat(gameId: string) {
  const { userId, orgId } = await auth()

  if (!userId) {
    Sentry.logger.warn("Chat access denied", {
      "game.id": gameId,
      reason: "unauthenticated",
    })
    throw new Error("Unauthorized")
  }

  // Also a game in another org: getGame is scoped to the caller's.
  if (!orgId || !(await getGame(gameId))) {
    Sentry.logger.warn("Chat access denied", {
      "game.id": gameId,
      reason: "not_found",
    })
    throw new Error("Not found")
  }

  return orgId
}

// Creates the game's chat session and its first run, and returns a
// session-scoped token. Idempotent per chat id. An org out of credits gets no
// session, so no run or sandbox starts; the chat tells the player why.
export async function startChatSession({
  chatId,
  clientData,
}: ChatStartSessionParams<typeof gameChat>) {
  const orgId = await assertCanChat(chatId)

  if (!(await hasCredits(orgId))) {
    Sentry.logger.info("Chat session blocked: out of credits", {
      "game.id": chatId,
      "org.id": orgId,
    })
    return { outOfCredits: true } as const
  }

  return startGameChatSession({ chatId, clientData })
}

// Mints a fresh session-scoped token; the transport calls this to refresh.
export async function mintChatAccessToken(chatId: string) {
  await assertCanChat(chatId)

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

// modelId is the model picked on the home page; the game's chat starts with it.
export async function createGame(input: string, modelId: GameModelId) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  Sentry.setUser({ id: userId })

  const prompt = typeof input === "string" ? input.trim() : ""

  if (!prompt) {
    return
  }

  const titleStartedAt = Date.now()
  const { text } = await generateText({
    model: titleModel,
    instructions:
      "Write a short title (at most 6 words) for a game based on the user's " +
      "description. Reply with the title only, without quotes.",
    prompt,
    maxOutputTokens: 32,
  })
  const titleDurationMs = Date.now() - titleStartedAt

  // Fall back to the raw prompt if the model returns nothing.
  const title = text.trim() || prompt

  // Save the prompt as the thread's first message; the game page's ChatThread
  // sees it unanswered and requests the reply.
  const [game] = await db
    .insert(games)
    .values({
      orgId,
      title,
      messages: [
        {
          id: generateId(),
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ],
    })
    .returning({ id: games.id })

  // The title call is what the player waits on before the game page opens.
  Sentry.logger.info("Game created", {
    "game.id": game.id,
    "org.id": orgId,
    "game.prompt_length": prompt.length,
    "game.title_from_prompt": !text.trim(),
    "gen_ai.request.model": titleModel.modelId,
    "game.title_duration_ms": titleDurationMs,
  })

  // The picked model rides along in the URL rather than being saved; the game
  // page hands it to the chat. It comes from the browser, so check it.
  const search = isGameModelId(modelId)
    ? `?${new URLSearchParams({ model: modelId })}`
    : ""

  // Re-render the (app) layout so the sidebar picks up the new game.
  refresh()
  redirect(`/games/${game.id}${search}`)
}

// The game id comes from the browser: only let the caller change games in
// their own org. Returns that org.
async function assertOwnsGame(gameId: string) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  // Also a game in another org: getGame is scoped to the caller's.
  if (!(await getGame(gameId))) {
    throw new Error("Not found")
  }

  return orgId
}

export async function renameGame(gameId: string, input: string) {
  const orgId = await assertOwnsGame(gameId)

  // The rename form enforces the same rules; this is for anything else.
  const title = typeof input === "string" ? input.trim() : ""

  if (!title || title.length > GAME_TITLE_MAX_LENGTH) {
    throw new Error("Invalid title")
  }

  await db
    .update(games)
    .set({ title })
    .where(and(eq(games.id, gameId), eq(games.orgId, orgId)))

  Sentry.logger.info("Game renamed", { "game.id": gameId, "org.id": orgId })

  // Re-render the sidebar and the game page's header with the new title.
  refresh()
}

// Deletes the game, then what ran for it: its chat run and its Daytona
// sandboxes. The row goes first, so a turn still running can't give the game a
// new sandbox (createGameSandbox deletes one whose game is gone). leavePage is
// true when the caller is on the game's own page.
export async function deleteGame(gameId: string, leavePage: boolean) {
  const orgId = await assertOwnsGame(gameId)

  await db
    .delete(games)
    .where(and(eq(games.id, gameId), eq(games.orgId, orgId)))

  // Close the chat's session so no message starts another run, then cancel
  // the current one, which would otherwise keep building (and charging for)
  // a game that's gone. The game is already deleted, so a failure here is
  // reported rather than shown to the player.
  try {
    const { currentRunId } = await sessions.retrieve(gameId)
    await sessions.close(gameId, { reason: "game deleted" })
    if (currentRunId) await runs.cancel(currentRunId)
  } catch (error) {
    Sentry.captureException(error, { tags: { game_id: gameId } })
  }

  try {
    await deleteGameSandboxes(gameId)
  } catch (error) {
    // Listing failed, so the game's sandboxes are still up.
    Sentry.captureException(error, { tags: { game_id: gameId } })
  }

  Sentry.logger.info("Game deleted", { "game.id": gameId, "org.id": orgId })

  // Re-render the sidebar without the game. Its own page would now render not
  // found, so a caller on it goes home instead.
  refresh()
  if (leavePage) redirect("/")
}
