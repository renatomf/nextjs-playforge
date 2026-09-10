import "server-only"

import type { UIMessage } from "ai"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

// Overwrites the game's full chat thread. Takes `orgId` explicitly because it
// runs at the end of a chat stream, outside the request's auth context.
export async function saveGameMessages(
  gameId: string,
  orgId: string,
  messages: UIMessage[]
) {
  await db
    .update(games)
    .set({ messages })
    .where(and(eq(games.id, gameId), eq(games.orgId, orgId)))
}
