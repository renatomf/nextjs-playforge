import "server-only"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

// The caller's org. Every page and the preview route come through here, so it
// also ties the request's logs and errors to the signed-in player.
async function getOrgId() {
  const { userId, orgId } = await auth()

  if (userId) Sentry.setUser({ id: userId })

  return orgId
}

export async function listGames() {
  const orgId = await getOrgId()

  if (!orgId) return []

  return db
    .select({ id: games.id, title: games.title })
    .from(games)
    .where(eq(games.orgId, orgId))
    .orderBy(desc(games.createdAt))
}

// `games.id` is a uuid column; Postgres throws on malformed input, so reject it up front.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getGame(id: string) {
  const orgId = await getOrgId()

  if (!orgId || !UUID_RE.test(id)) return null

  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
    .limit(1)

  return game ?? null
}
