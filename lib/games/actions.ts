"use server"

import { google } from "@ai-sdk/google"
import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"
import { generateId, generateText } from "ai"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { getGame } from "@/lib/games/queries"
import type { gameChat } from "@/trigger/chat"

const startGameChatSession =
  chat.createStartSessionAction<typeof gameChat>("game-chat")

// The chat id is the game id, and it comes from the browser: only let the
// caller chat about games in their own org.
async function assertCanChat(gameId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("Unauthorized")
  }

  if (!(await getGame(gameId))) {
    throw new Error("Not found")
  }
}

// Creates the game's chat session and its first run, and returns a
// session-scoped token. Idempotent per chat id.
export async function startChatSession({
  chatId,
  clientData,
}: ChatStartSessionParams<typeof gameChat>) {
  await assertCanChat(chatId)

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

export async function createGame(input: string) {
  const { orgId } = await auth()

  if (!orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  const prompt = typeof input === "string" ? input.trim() : ""

  if (!prompt) {
    return
  }

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    instructions:
      "Write a short title (at most 6 words) for a game based on the user's " +
      "description. Reply with the title only, without quotes.",
    prompt,
    maxOutputTokens: 32,
  })

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

  // Re-render the (app) layout so the sidebar picks up the new game.
  refresh()
  redirect(`/games/${game.id}`)
}
