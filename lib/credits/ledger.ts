import "server-only"

import { eq, sql } from "drizzle-orm"

import { DOLLAR } from "@/lib/credits/format"
import { db } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"

// Every org gets $1 of credits to start. It isn't a ledger row, so an org with
// no rows reads exactly $1.00.
export const FREE_CREDITS = 1 * DOLLAR

export async function getBalance(orgId: string) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)`.mapWith(
        Number
      ),
    })
    .from(creditLedger)
    .where(eq(creditLedger.orgId, orgId))

  return FREE_CREDITS + (row?.total ?? 0)
}

// Charges an org for one model step. The step's response id is the entry key,
// so a step is never charged twice.
export async function chargeStep(
  orgId: string,
  responseId: string,
  cost: number
) {
  // A free step (a local model) leaves no row.
  if (cost === 0) return

  await db
    .insert(creditLedger)
    .values({ orgId, entryKey: `step:${responseId}`, amount: -cost })
    .onConflictDoNothing({ target: [creditLedger.orgId, creditLedger.entryKey] })
}
