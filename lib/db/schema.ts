// Drizzle schema: define tables here, then run `npm run db:push`.

import type { UIMessage } from "ai"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const games = pgTable(
  "games",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Clerk organization ID (e.g. "org_..."); every query is scoped by it.
    orgId: text("org_id").notNull(),
    title: text().notNull(),
    // The game's chat thread (one game = one chat), in AI SDK UIMessage format.
    messages: jsonb().$type<UIMessage[]>().notNull().default([]),
    // Trigger.dev chat stream cursor, saved with `messages` after each turn so
    // a reload resumes the stream where the saved thread ends.
    lastEventId: text("last_event_id"),
    // The game's Daytona sandbox, created when its chat starts.
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Covers "games for this org" lookups and listing them newest-first.
  (t) => [index("games_org_id_created_at_idx").on(t.orgId, t.createdAt)]
)

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
