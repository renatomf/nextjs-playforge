import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import { DOLLAR } from "@/lib/credits/format"
import { db } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"

// Credits added for every month an org has paid for.
export const MONTHLY_GRANT = 10 * DOLLAR

// Item statuses whose current period is paid for. A canceled item stays paid
// until its period ends.
const PAID_STATUSES = new Set(["active", "canceled"])

// A period starts moments after its item is created; this absorbs clock skew
// between the two without reaching back into a free trial.
const CREATED_AT_SLACK_MS = 60 * 60 * 1000

// "2026-09"
const monthKey = (date: Date) => date.toISOString().slice(0, 7)

const daysInUTCMonth = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate()

// `date` moved by `months` months onto `day` of the month, clamped to shorter
// months. Done in UTC: date-fns' addMonths uses the server's local time zone,
// which knocks month boundaries off UTC (a period starting at 00:00Z falls on
// the previous day west of UTC).
function addUTCMonths(date: Date, months: number, day: number) {
  const result = new Date(date)
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  result.setUTCDate(Math.min(day, daysInUTCMonth(result)))
  return result
}

// Grants the org MONTHLY_GRANT for each month its subscription has paid for.
// Grants are keyed by the month they cover, so reconciling again (or a new
// subscription item in the same month) never grants a month twice.
export async function reconcileCredits(orgId: string) {
  const client = await clerkClient()
  const subscription =
    await client.billing.getOrganizationBillingSubscription(orgId)

  const months = new Set<string>()

  for (const item of subscription.subscriptionItems) {
    // Free plans and free trials haven't paid for anything.
    if (
      !item.plan?.hasBaseFee ||
      item.isFreeTrial ||
      !PAID_STATUSES.has(item.status)
    ) {
      continue
    }

    // Clerk only reports the current period, so walk back one period at a
    // time to when the item was created; each of those periods renewed, so
    // each was paid for. Periods start on the same day each month, clamped to
    // shorter months, so a start on a month's last day (Apr 30 for an anchor
    // on the 31st) walks back from the 31st.
    const current = new Date(item.periodStart)
    const day =
      current.getUTCDate() === daysInUTCMonth(current)
        ? 31
        : current.getUTCDate()
    const periodMonths = item.planPeriod === "annual" ? 12 : 1
    for (let n = 0; ; n++) {
      const start = addUTCMonths(current, -n * periodMonths, day)
      if (n > 0 && !(start.getTime() >= item.createdAt - CREATED_AT_SLACK_MS))
        break

      for (let m = 0; m < periodMonths; m++) {
        months.add(monthKey(addUTCMonths(start, m, day)))
      }
    }
  }

  if (months.size === 0) return

  await db
    .insert(creditLedger)
    .values(
      [...months].map((month) => ({
        orgId,
        entryKey: `month:${month}`,
        amount: MONTHLY_GRANT,
      }))
    )
    .onConflictDoNothing({ target: [creditLedger.orgId, creditLedger.entryKey] })
}
