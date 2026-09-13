"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"
import { generateId, generateText } from "ai"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { isGameModelId, type GameModelId } from "@/lib/ai/model-catalog"
import { titleModel } from "@/lib/ai/models"
import { hasCredits } from "@/lib/credits/reconcile"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { getGame } from "@/lib/games/queries"
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
