import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { isStepCount, streamText, type UIMessage } from "ai"

import { chatModel } from "@/lib/ai/models"
import { createGameSandbox } from "@/lib/daytona/utils"
import { gameInstructions } from "@/lib/games/instructions"
import { getGameMessages, saveGameMessages } from "@/lib/games/messages"
import { createGameTools } from "@/lib/games/tools"

// Most model steps one turn may take. Each step can call several tools, so
// this leaves room to read, write, and fix a whole game in one reply.
const MAX_STEPS = 30

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
  // Fires once per chat, on its first message: give the game its sandbox.
  onChatStart: async ({ chatId }) => {
    await createGameSandbox(chatId)
  },
  onTurnComplete: async ({ chatId, uiMessages, lastEventId }) => {
    // Always save the cursor, even for a failed turn, so a reload resumes past it.
    await saveGameMessages(chatId, withoutEmptyReplies(uiMessages), lastEventId)
  },
  uiMessageStreamOptions: {
    // Don't send raw error details (keys, stack traces) to the browser.
    onError: () => "An error occurred.",
  },
  // Resolved each turn, so the file tools are bound to this game's sandbox.
  tools: ({ chatId }) => createGameTools(chatId),
  run: async ({ messages, tools, signal }) =>
    streamText({
      // Spread first so the options below still win.
      ...chat.toStreamTextOptions({ tools }),
      model: chatModel,
      instructions: gameInstructions,
      messages,
      abortSignal: signal,
      stopWhen: isStepCount(MAX_STEPS),
    }),
})
