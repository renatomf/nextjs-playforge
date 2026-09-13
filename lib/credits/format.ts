// Ledger amounts are integer billionths of a dollar, so the fractions of a
// cent each model step costs add up exactly.
export const DOLLAR = 1_000_000_000

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  // A balance that rounds to zero reads "$0.00", not "-$0.00".
  signDisplay: "negative",
})

export function formatDollars(amount: number) {
  return dollars.format(amount / DOLLAR)
}
