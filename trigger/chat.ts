import { google } from "@ai-sdk/google"
import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { streamText, type UIMessage } from "ai"

import { getGameMessages, saveGameMessages } from "@/lib/games/messages"

// A turn that fails before the model writes anything (e.g. the provider is
// overloaded) still produces an assistant message, with no content. Drop it so
// the thread keeps ending in the unanswered user message.
function withoutEmptyReplies(messages: UIMessage[]) {
  return messages.filter(
    (message) =>
      message.role !== "assistant" ||
      message.parts.some((part) => part.type !== "step-start")
  )
}

// One game = one chat: the chat id is the game id, and the game row's
// `messages` stays the source of truth for the thread.
export const gameChat = chat.agent({
  id: "game-chat",
  // Load the saved thread every turn; the client only sends the new message,
  // or none when it wants a reply to the saved thread (e.g. the game's first
  // prompt, requested with regenerate).
  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const messages = withoutEmptyReplies(await getGameMessages(chatId))

    // Save the new user message before the model streams, so a reload
    // mid-reply still shows it.
    if (upsertIncomingMessage(messages, { trigger, incomingMessages })) {
      await saveGameMessages(chatId, messages)
    }

    // Only a user message can be replied to.
    if (messages.at(-1)?.role !== "user") {
      throw new Error("Nothing to reply to")
    }

    return messages
  },
  onTurnComplete: async ({ chatId, uiMessages, lastEventId }) => {
    // Always save the cursor, even for a failed turn, so a reload resumes past it.
    await saveGameMessages(chatId, withoutEmptyReplies(uiMessages), lastEventId)
  },
  uiMessageStreamOptions: {
    // Don't send raw error details (keys, stack traces) to the browser.
    onError: () => "An error occurred.",
  },
  run: async ({ messages, signal }) =>
    streamText({
      // Spread first so the options below still win.
      ...chat.toStreamTextOptions(),
      model: google("gemini-flash-latest"),
      instructions: "You are a helpful assistant.",
      messages,
      abortSignal: signal,
    }),
})
