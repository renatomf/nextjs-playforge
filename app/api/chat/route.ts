import { google } from "@ai-sdk/google"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai"

import { saveGameMessages } from "@/lib/games/messages"
import { getGame } from "@/lib/games/queries"

export const maxDuration = 30

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  // `id` is the game id; the client sends only the new message, or none when
  // it wants a reply to the saved thread (e.g. the game's first prompt).
  const { id, message }: { id: string; message?: unknown } = await req.json()

  const game = await getGame(id)

  if (!game) {
    return new Response("Not found", { status: 404 })
  }

  // Full thread = saved messages + the new one from the client.
  const validated = await safeValidateUIMessages({
    messages:
      message === undefined ? game.messages : [...game.messages, message],
  })

  if (!validated.success) {
    return new Response("Invalid message", { status: 400 })
  }

  const messages = validated.data

  // Only a user message can be replied to.
  if (messages[messages.length - 1]?.role !== "user") {
    return new Response("Nothing to reply to", { status: 400 })
  }

  const result = streamText({
    model: google("gemini-flash-latest"),
    instructions: "You are a helpful assistant.",
    messages: await convertToModelMessages(messages),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      // Without this, the saved assistant message would have an empty id.
      generateMessageId: generateId,
      onEnd: ({ messages }) => saveGameMessages(game.id, game.orgId, messages),
    }),
  })
}
