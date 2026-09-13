import * as Sentry from "@sentry/node"
import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { isStepCount, isToolUIPart, streamText, type UIMessage } from "ai"

import { chatModel } from "@/lib/ai/models"
import { createGameSandbox } from "@/lib/daytona/utils"
import { gameInstructions } from "@/lib/games/instructions"
import { getGameMessages, saveGameMessages } from "@/lib/games/messages"
import { createGameTools } from "@/lib/games/tools"

// Most model steps one turn may take. Each step can call several tools, so
// this leaves room to read, write, and fix a whole game in one reply.
const MAX_STEPS = 30

// By chat id, how many tool calls the assistant message a turn resumes
// already has: set in hydrateMessages, read by onTurnComplete.
const toolCallsBeforeTurn = new Map<string, number>()

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

    // Reply to a new user message, or resume the assistant message whose
    // pending tool call (e.g. ask_player) the player just answered. The
    // runtime merges their answer into it after this hook returns.
    const last = messages.at(-1)
    const isResume =
      last?.role === "assistant" &&
      incomingMessages.some((message) => message.id === last.id)

    // A resumed message still holds the earlier turns' tool calls (the
    // answered questions); the turn summary counts only the ones after them.
    toolCallsBeforeTurn.set(
      chatId,
      isResume ? last.parts.filter(isToolUIPart).length : 0
    )

    if (last?.role !== "user" && !isResume) {
      throw new Error("Nothing to reply to")
    }

    return messages
  },
  // Fires once per chat, on its first message: give the game its sandbox.
  onChatStart: async ({ chatId }) => {
    await createGameSandbox(chatId)
  },
  onTurnComplete: async ({
    chatId,
    runId,
    turn,
    uiMessages,
    responseMessage,
    lastEventId,
    stopped,
    finishReason,
    usage,
    error,
  }) => {
    // A failed turn ends with an error chunk but doesn't fail the run, so the
    // global onFailure hook (trigger/init.ts) never sees it: report it here.
    if (error) {
      Sentry.captureException(error, { tags: { chat_id: chatId } })
    }

    // Always save the cursor, even for a failed turn, so a reload resumes past it.
    await saveGameMessages(chatId, withoutEmptyReplies(uiMessages), lastEventId)

    // One summary per turn. Each failed tool call is also logged on its own
    // (lib/games/tools.ts); a pending one is an ask_player question.
    const toolParts = (responseMessage?.parts.filter(isToolUIPart) ?? []).slice(
      toolCallsBeforeTurn.get(chatId) ?? 0
    )
    toolCallsBeforeTurn.delete(chatId)
    Sentry.logger[error ? "error" : "info"](
      error ? "Chat turn failed" : "Chat turn completed",
      {
        "game.id": chatId,
        "trigger.run": runId,
        "chat.turn": turn,
        "chat.stopped": stopped,
        "chat.tool_calls": toolParts.length,
        "chat.tool_errors": toolParts.filter(
          (part) => part.state === "output-error"
        ).length,
        "chat.awaiting_player": toolParts.some(
          (part) => part.state === "input-available"
        ),
        "gen_ai.request.model": chatModel.modelId,
        "gen_ai.response.finish_reasons": finishReason ?? "unknown",
        // Left out when unknown: an undefined attribute is sent as "".
        ...(usage?.inputTokens !== undefined && {
          "gen_ai.usage.input_tokens": usage.inputTokens,
        }),
        ...(usage?.outputTokens !== undefined && {
          "gen_ai.usage.output_tokens": usage.outputTokens,
        }),
      }
    )

    // Send the turn's logs (and error) before the run suspends to wait for
    // the next message.
    await Sentry.flush(2000)
  },
  uiMessageStreamOptions: {
    // Don't send raw error details (keys, stack traces) to the browser; they
    // go to Sentry instead.
    onError: (error) => {
      Sentry.captureException(error)
      return "An error occurred."
    },
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
