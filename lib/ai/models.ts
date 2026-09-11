import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai"
import { ollama } from "ollama-ai-provider-v2"

// Every model the app uses, per provider. AI_PROVIDER picks the provider;
// to try another model, change it here.
const models = {
  anthropic: {
    chat: anthropic("claude-sonnet-5"),
    title: anthropic("claude-haiku-4-5"),
  },
  google: {
    chat: google("gemini-flash-latest"),
    title: google("gemini-flash-lite-latest"),
  },
  // Needs a local Ollama server (`ollama pull glm-4.7-flash`).
  ollama: {
    chat: ollama("glm-4.7-flash"),
    // Titles get only a few output tokens: skip the model's thinking, which
    // would use them all up and leave the title empty.
    title: wrapLanguageModel({
      model: ollama("glm-4.7-flash"),
      middleware: defaultSettingsMiddleware({
        settings: { providerOptions: { ollama: { think: false } } },
      }),
    }),
  },
}

const provider = process.env.AI_PROVIDER ?? "google"

if (!Object.hasOwn(models, provider)) {
  throw new Error(`Unknown AI_PROVIDER: ${provider}`)
}

export const { chat: chatModel, title: titleModel } =
  models[provider as keyof typeof models]
