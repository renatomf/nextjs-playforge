import type { LanguageModelUsage } from "ai"

import type { GameModelId } from "@/lib/ai/model-catalog"
import { DOLLAR } from "@/lib/credits/format"

// Dollars per million tokens. A prompt's input splits into fresh tokens,
// tokens read from the provider's prompt cache, and tokens written to it, and
// each is priced differently. Output includes thinking tokens.
type ModelPrice = {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

// Each provider's pay-as-you-go list price (checked 2026-09-13), whatever
// tier the app's own keys are on.
const MODEL_PRICES = {
  // Cache reads are 0.1x input; writes (5-minute cache) are 1.25x.
  "claude-opus-5": { input: 5, cacheRead: 0.5, cacheWrite: 6.25, output: 25 },
  // Introductory price through 2026-12-31; it doubles on 2027-01-01.
  // Implicit caching has no write fee.
  "gemini-3.8-flash": {
    input: 0.75,
    cacheRead: 0.075,
    cacheWrite: 0.75,
    output: 3.75,
  },
  // Groq lists no cache write fee.
  "openai/gpt-oss-120b": {
    input: 0.15,
    cacheRead: 0.075,
    cacheWrite: 0.15,
    output: 0.6,
  },
  // Model Studio's international price: cache hits are 0.1x input, explicit
  // cache creation 1.25x.
  "qwen3.8-max": { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 6 },
  // Runs on the player's own machine.
  "qwen3:8b": { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
} satisfies Record<GameModelId, ModelPrice>

// What one model step cost, in ledger units (billionths of a dollar).
export function stepCost(modelId: GameModelId, usage: LanguageModelUsage) {
  const price = MODEL_PRICES[modelId]
  const { cacheReadTokens = 0, cacheWriteTokens = 0 } = usage.inputTokenDetails
  // A provider that doesn't split out fresh input still reports the total.
  const freshTokens =
    usage.inputTokenDetails.noCacheTokens ??
    Math.max(0, (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens)

  // Tokens times dollars per million tokens: millionths of a dollar.
  const microdollars =
    freshTokens * price.input +
    cacheReadTokens * price.cacheRead +
    cacheWriteTokens * price.cacheWrite +
    (usage.outputTokens ?? 0) * price.output

  return Math.round(microdollars * (DOLLAR / 1_000_000))
}
