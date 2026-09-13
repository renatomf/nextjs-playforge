import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import type { Metadata } from "next"

import { formatDollars } from "@/lib/credits/format"
import { FREE_CREDITS, getBalance } from "@/lib/credits/ledger"
import { MONTHLY_GRANT, reconcileCredits } from "@/lib/credits/reconcile"

export const metadata: Metadata = {
  title: "Billing",
}

export default async function Page() {
  const { orgId } = await auth.protect({ unauthenticatedUrl: "/sign-in" })

  let balance = FREE_CREDITS
  if (orgId) {
    // Grant any months paid for since the last visit. A failed Clerk call is
    // reported rather than taking the page down; the ledger still has a balance.
    await reconcileCredits(orgId).catch((error) =>
      Sentry.captureException(error)
    )
    balance = await getBalance(orgId)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10">
      <h1 className="mb-12 font-heading text-3xl font-semibold tracking-tight">
        Billing
      </h1>
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Available credits</p>
        <p className="font-heading text-5xl font-semibold tracking-tight">
          {formatDollars(balance)}
        </p>
        <p className="max-w-2xl text-muted-foreground">
          Credits cover the models that build and revise your games. A scene
          already in progress can finish below zero; the next build waits for
          more credits.
        </p>
      </section>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Keep the studio running
          </h2>
          <p className="text-muted-foreground">
            Builder adds {formatDollars(MONTHLY_GRANT)} every month, and unused
            credits roll over.
          </p>
        </div>
        <PricingTable for="organization" />
      </section>
    </div>
  )
}
