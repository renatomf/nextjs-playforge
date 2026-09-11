import "server-only"

import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

// These run inside the Trigger.dev chat agent, outside any request, so they
// can't use Clerk's auth(). The game id is the chat id, and the chat server
// actions only start sessions and mint tokens for games in the caller's org.

export async function getGameMessages(gameId: string) {
  const [game] = await db
    .select({ messages: games.messages })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) {
    throw new Error("Game not found")
  }

  return game.messages
}

// Overwrites the game's full chat thread. `lastEventId` goes in the same
// UPDATE so a reload never sees the new thread with the previous turn's cursor.
export async function saveGameMessages(
  gameId: string,
  messages: UIMessage[],
  lastEventId?: string
) {
  await db
    .update(games)
    .set(lastEventId === undefined ? { messages } : { messages, lastEventId })
    .where(eq(games.id, gameId))
}
