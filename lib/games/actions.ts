"use server"

import { google } from "@ai-sdk/google"
import { auth } from "@clerk/nextjs/server"
import { generateText } from "ai"
import { refresh } from "next/cache"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

export async function createGame(input: string) {
  const { orgId } = await auth()

  if (!orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  const prompt = typeof input === "string" ? input.trim() : ""

  if (!prompt) {
    return
  }

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    instructions:
      "Write a short title (at most 6 words) for a game based on the user's " +
      "description. Reply with the title only, without quotes.",
    prompt,
    maxOutputTokens: 32,
  })

  // Fall back to the raw prompt if the model returns nothing.
  const title = text.trim() || prompt

  await db.insert(games).values({ orgId, title })

  // Re-render the (app) layout so the sidebar picks up the new game.
  refresh()
}
