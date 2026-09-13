"use client"

import { createContext, use, useState } from "react"

type CreditBalance = {
  // In ledger units (see lib/credits/format).
  balance: number
  setBalance: (balance: number) => void
}

const CreditBalanceContext = createContext<CreditBalance | null>(null)

// The org's credit balance for the app shell. The layout reads it from the
// ledger; a game's chat sends a new one after every step it charges.
export function CreditBalanceProvider({
  balance: ledgerBalance,
  children,
}: {
  balance: number
  children: React.ReactNode
}) {
  const [balance, setBalance] = useState(ledgerBalance)

  // A fresh render of the layout (e.g. after creating a game) reads the
  // ledger again; take its balance over the last one the chat sent.
  const [prevLedgerBalance, setPrevLedgerBalance] = useState(ledgerBalance)
  if (ledgerBalance !== prevLedgerBalance) {
    setPrevLedgerBalance(ledgerBalance)
    setBalance(ledgerBalance)
  }

  return (
    <CreditBalanceContext value={{ balance, setBalance }}>
      {children}
    </CreditBalanceContext>
  )
}

export function useCreditBalance() {
  const context = use(CreditBalanceContext)

  if (!context) {
    throw new Error(
      "useCreditBalance must be used within a CreditBalanceProvider"
    )
  }

  return context
}
