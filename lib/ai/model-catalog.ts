// The models a game's chat can reply with. Client-safe: no provider imports,
// so a model picker can read it; lib/ai/models.ts maps each id to its model.
export const GAME_MODELS = [
  {
    id: "claude-opus-5",
    name: "Opus 5",
    tagline: "The most capable builder - best for a game from scratch.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tagline: "Fast and capable - great for everyday changes to your game.",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    tagline: "The fastest replies - best for small tweaks.",
  },
  {
    id: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    tagline: "Alibaba's flagship - a solid all-round builder.",
  },
  {
    id: "qwen3:8b",
    name: "Qwen3 8B (local)",
    tagline: "Runs on your own machine - free and private, for small tweaks.",
  },
] as const

export type GameModelId = (typeof GAME_MODELS)[number]["id"]

export const GAME_MODEL_IDS = GAME_MODELS.map((model) => model.id)

// For ids from outside the app's code, like a URL or a server action argument.
export function isGameModelId(value: unknown): value is GameModelId {
  return GAME_MODELS.some((model) => model.id === value)
}

export const DEFAULT_GAME_MODEL_ID: GameModelId = "claude-opus-5"
