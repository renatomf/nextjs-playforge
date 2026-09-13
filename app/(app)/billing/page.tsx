import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Billing",
}

// Placeholder until credit balances are wired up.
const availableCredits = "$8.80"

export default async function Page() {
  await auth.protect({ unauthenticatedUrl: "/sign-in" })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10">
      <h1 className="mb-12 font-heading text-3xl font-semibold tracking-tight">
        Billing
      </h1>
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Available credits</p>
        <p className="font-heading text-5xl font-semibold tracking-tight">
          {availableCredits}
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
            Builder adds $10.00 every month, and unused credits roll over.
          </p>
        </div>
        <PricingTable for="organization" />
      </section>
    </div>
  )
}
