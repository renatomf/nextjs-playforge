import "server-only"

import { createAlibaba } from "@ai-sdk/alibaba"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { groq } from "@ai-sdk/groq"
import type { LanguageModel } from "ai"
import { ollama } from "ollama-ai-provider-v2"

import type { GameModelId } from "@/lib/ai/model-catalog"

// Qwen through Alibaba Model Studio (DashScope); the provider would otherwise
// read ALIBABA_API_KEY.
const alibaba = createAlibaba({ apiKey: process.env.DASHSCOPE_API_KEY })

// The model behind each id in the catalog (lib/ai/model-catalog.ts). Opus is
// paid; the others run on their providers' free tiers. Keys come from
// ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, and
// DASHSCOPE_API_KEY.
export const chatModels = {
  "claude-opus-5": anthropic("claude-opus-5"),
  "gemini-3.8-flash": google("gemini-3.8-flash"),
  "openai/gpt-oss-120b": groq("openai/gpt-oss-120b"),
  "qwen3.8-max": alibaba("qwen3.8-max"),
  // No key: needs a local Ollama server (`ollama pull qwen3:8b`). Small enough
  // for a 6 GB GPU, unlike larger local models.
  "qwen3:8b": ollama("qwen3:8b"),
} satisfies Record<GameModelId, LanguageModel>

export const titleModel = anthropic("claude-haiku-4-5")
