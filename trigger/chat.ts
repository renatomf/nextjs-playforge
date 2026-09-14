import * as Sentry from "@sentry/node"
import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { isToolUIPart, streamText, type UIMessage } from "ai"
import { z } from "zod"

import { gameAgentSettings } from "@/lib/ai/agent"
import { DEFAULT_GAME_MODEL_ID, GAME_MODEL_IDS } from "@/lib/ai/model-catalog"
import { chargeStep, getBalance } from "@/lib/credits/ledger"
import { stepCost } from "@/lib/credits/pricing"
import { hasCredits } from "@/lib/credits/reconcile"
import { createGameSandbox } from "@/lib/daytona/utils"
import {
  getGameMessages,
  getGameOrgId,
  saveGameMessages,
} from "@/lib/games/messages"
import { createGameTools } from "@/lib/games/tools"

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

// Copies the player's answers to a saved reply's pending tool calls (e.g.
// ask_player) from the message that carries them: a copy of the reply slimmed
// to the answered calls. Matched by tool call id, since the copy doesn't
// always keep the reply's id. Returns whether it answers any of them.
function applyAnswers(reply: UIMessage, incoming: UIMessage) {
  const answers = new Map(
    incoming.parts
      .filter(isToolUIPart)
      .filter(
        (part) =>
          part.state === "output-available" || part.state === "output-error"
      )
      .map((part) => [part.toolCallId, part])
  )
  let hasAnswer = false

  reply.parts = reply.parts.map((part) => {
    if (!isToolUIPart(part)) return part

    const answer = answers.get(part.toolCallId)
    if (!answer) return part

    hasAnswer = true

    // A settled call keeps its result; only a pending one takes the answer.
    if (part.state !== "input-available") return part

    return answer.state === "output-available"
      ? { ...part, state: "output-available", output: answer.output }
      : { ...part, state: "output-error", errorText: answer.errorText }
  })

  return hasAnswer
}

// One game = one chat: the chat id is the game id, and the game row's
// `messages` stays the source of truth for the thread.
export const gameChat = chat.agent({
  id: "game-chat",
  // Sent by the client with every message; checked each turn. Without it (or
  // without a model) the reply uses the default model.
  clientDataSchema: z
    .object({ model: z.enum(GAME_MODEL_IDS).optional() })
    .optional(),
  // Load the saved thread every turn; the client only sends the new message,
  // or none when it wants a reply to the saved thread (e.g. the game's first
  // prompt, requested with regenerate).
  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const messages = withoutEmptyReplies(await getGameMessages(chatId))
    const incoming = incomingMessages.at(-1)
    const last = messages.at(-1)

    // Resume the last reply when the player answered its pending tool call
    // (e.g. ask_player). The runtime merges the answer too, after this hook
    // returns, but only into a message with the same id.
    const isResume =
      incoming?.role === "assistant" &&
      last?.role === "assistant" &&
      applyAnswers(last, incoming)

    // Save the new user message, or the player's answer, before the model
    // streams, so a reload mid-reply still shows it instead of asking the
    // question again. An answer that matches no pending call isn't saved: its
    // copy of the reply is slimmed to the answer and can't stand on its own.
    if (
      isResume ||
      (incoming?.role !== "assistant" &&
        upsertIncomingMessage(messages, { trigger, incomingMessages }))
    ) {
      await saveGameMessages(chatId, messages)
    }

    // A resumed message still holds the earlier turns' tool calls (the
    // answered questions); the turn summary counts only the ones after them.
    toolCallsBeforeTurn.set(
      chatId,
      isResume ? last.parts.filter(isToolUIPart).length : 0
    )

    if (messages.at(-1)?.role !== "user" && !isResume) {
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
    clientData,
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
        "gen_ai.request.model": gameAgentSettings(clientData?.model).model
          .modelId,
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
  run: async ({ chatId, messages, tools, clientData, signal }) => {
    const modelId = clientData?.model ?? DEFAULT_GAME_MODEL_ID
    // The game's org pays for every step of the reply. The worker has no
    // auth(), so the org comes from the game row.
    const orgId = await getGameOrgId(chatId)

    // Every turn needs credits, including the one that resumes a reply after
    // the player answers a question. Only the steps of a reply already
    // streaming run past zero.
    if (!(await hasCredits(orgId))) {
      Sentry.logger.info("Chat turn blocked: out of credits", {
        "game.id": chatId,
        "org.id": orgId,
      })
      // Transient: the chat shows a notice; nothing is saved to the thread.
      chat.response.write({
        type: "data-out-of-credits",
        data: null,
        transient: true,
      })
      return
    }

    return streamText({
      // Spread first so the options below still win.
      ...chat.toStreamTextOptions({ tools }),
      ...gameAgentSettings(modelId),
      messages,
      abortSignal: signal,
      onStepEnd: async (step) => {
        try {
          await chargeStep(
            orgId,
            step.response.id,
            stepCost(modelId, step.usage)
          )
          // The sidebar shows the new balance as the game builds. Transient:
          // it isn't saved into the thread.
          chat.response.write({
            type: "data-balance",
            data: await getBalance(orgId),
            transient: true,
          })
        } catch (error) {
          // A failed charge shouldn't cut the reply short.
          Sentry.captureException(error, { tags: { chat_id: chatId } })
        }
      },
    })
  },
})
