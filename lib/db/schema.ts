// Drizzle schema: define tables here, then run `npm run db:push`.

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const games = pgTable(
  "games",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Clerk organization ID (e.g. "org_..."); every query is scoped by it.
    orgId: text("org_id").notNull(),
    title: text().notNull(),
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
