"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import * as Sentry from "@sentry/nextjs"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatTransport,
  type DynamicToolUIPart,
  type InferUITool,
  type ToolUIPart,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"

import { ChatComposer } from "@/components/chat-composer"
import { useCreditBalance } from "@/components/credit-balance"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_GAME_MODEL_ID, type GameModelId } from "@/lib/ai/model-catalog"
import type { askPlayer } from "@/lib/games/ask-player"
import { mintChatAccessToken, startChatSession } from "@/lib/games/actions"
import type { gameChat } from "@/trigger/chat"

type ChatThreadProps = {
  id: string
  initialMessages: UIMessage[]
  // The game's chat session, once it has one; lets a reload resume the stream.
  initialSession?: { publicAccessToken: string; lastEventId: string }
  // The model the chat starts with, e.g. the one picked on the home page.
  initialModelId?: GameModelId
  // Called each time the agent finishes a turn that replied on this page.
  onTurnComplete?: () => void
}

type ToolCallState = "active" | "done" | "failed"

// Thrown when the org is out of credits and no chat session starts; the chat
// shows the out-of-credits notice for it, not an error.
const OUT_OF_CREDITS_ERROR = "Out of credits"

// The chat's messages don't carry tool types, so ask_player parts are typed
// from the tool itself.
type AskPlayerTool = InferUITool<typeof askPlayer>
type AskPlayerPart = ToolUIPart<{ ask_player: AskPlayerTool }>

// What each game tool does, keyed by tool name (see lib/games/tools.ts).
const TOOL_LABELS: Record<string, string> = {
  write_file: "Write",
  replace_text: "Edit",
  read_file: "Read",
  list_files: "List files",
  delete_file: "Delete",
  ask_player: "Question",
}

// Read by screen readers, since the state icon is decorative.
const TOOL_STATE_LABELS: Record<ToolCallState, string> = {
  active: "(running)",
  done: "(done)",
  failed: "(failed)",
}

function isAskPlayerPart(
  part: ToolUIPart | DynamicToolUIPart
): part is AskPlayerPart {
  return part.type === "tool-ask_player"
}

// Whether a message ends on a question the player hasn't answered yet.
function isAwaitingAnswer(message: UIMessage | undefined) {
  return (
    message?.parts.some(
      (part) =>
        isToolUIPart(part) &&
        isAskPlayerPart(part) &&
        part.state === "input-available"
    ) ?? false
  )
}

// Drops what a new turn's stream replays from the turn before it. The
// transport resumes from the last chunk this page read, so after a stop (or a
// reply whose stream broke) it first replays the rest of that turn: deltas for
// parts this stream never started, which useChat rejects ("Received
// tool-input-delta for missing tool call") while the agent keeps building.
// A turn's own chunks begin at its `start` chunk; data parts (the balance, the
// out-of-credits notice) and errors, which a turn can send without one, pass.
function fromTurnStart(stream: ReadableStream<UIMessageChunk>) {
  let hasStarted = false

  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === "start") hasStarted = true

        if (
          hasStarted ||
          chunk.type === "error" ||
          chunk.type.startsWith("data-")
        ) {
          controller.enqueue(chunk)
        }
      },
    })
  )
}

// A saved reply's parts as the chunks that would stream them.
function toChunks(message: UIMessage): UIMessageChunk[] {
  return message.parts.flatMap((part, index): UIMessageChunk[] => {
    const id = `${message.id}-${index}`

    if (part.type === "step-start") return [{ type: "start-step" }]

    if (part.type === "text") {
      return [
        { type: "text-start", id },
        { type: "text-delta", id, delta: part.text },
        { type: "text-end", id },
      ]
    }

    if (part.type === "reasoning") {
      return [
        { type: "reasoning-start", id },
        { type: "reasoning-delta", id, delta: part.text },
        { type: "reasoning-end", id },
      ]
    }

    if (!isToolUIPart(part)) return []

    const { toolCallId } = part
    const dynamic = part.type === "dynamic-tool"
    const call: UIMessageChunk = {
      type: "tool-input-available",
      toolCallId,
      toolName: getToolName(part),
      input: part.input,
      dynamic,
    }

    switch (part.state) {
      case "output-available":
        return [
          call,
          {
            type: "tool-output-available",
            toolCallId,
            output: part.output,
            dynamic,
          },
        ]
      case "output-error":
        return [
          call,
          {
            type: "tool-output-error",
            toolCallId,
            errorText: part.errorText,
            dynamic,
          },
        ]
      default:
        return [call]
    }
  })
}

// A reload resumes the reply still streaming. When that reply continues the
// last saved one (the player answered its question), useChat rebuilds it from
// the resumed stream alone and replaces the saved one: the question flashes,
// then disappears. Put the saved parts back ahead of the resumed ones.
function withSavedReply(
  stream: ReadableStream<UIMessageChunk>,
  saved: UIMessage | undefined
) {
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        controller.enqueue(chunk)

        if (
          chunk.type === "start" &&
          saved?.role === "assistant" &&
          chunk.messageId === saved.id
        ) {
          for (const savedChunk of toChunks(saved)) {
            controller.enqueue(savedChunk)
          }
        }
      },
    })
  )
}

function getToolCallState(
  part: ToolUIPart | DynamicToolUIPart,
  isStreaming: boolean
): ToolCallState {
  switch (part.state) {
    case "output-available":
      return "done"
    case "output-error":
    case "output-denied":
      return "failed"
    default:
      // Still waiting on a result: only running while the reply streams.
      return isStreaming ? "active" : "failed"
  }
}

// The file a tool acts on. The input is still partial while it streams.
function getToolPath(input: unknown) {
  if (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof input.path === "string"
  ) {
    return input.path
  }
}

function ToolCallMarker({
  part,
  isStreaming,
}: {
  part: ToolUIPart | DynamicToolUIPart
  isStreaming: boolean
}) {
  const state = getToolCallState(part, isStreaming)
  const name = getToolName(part)
  const path = getToolPath(part.input)

  return (
    <Marker className={cn(state === "failed" && "text-destructive")}>
      <MarkerIcon>
        {state === "active" ? (
          <Spinner />
        ) : state === "done" ? (
          <CheckIcon />
        ) : (
          <XIcon />
        )}
      </MarkerIcon>
      <MarkerContent>
        {TOOL_LABELS[name] ?? name}
        {path && <code className="ml-1.5 font-mono text-xs">{path}</code>}
        <span className="sr-only"> {TOOL_STATE_LABELS[state]}</span>
      </MarkerContent>
    </Marker>
  )
}

// An ask_player question the player answers by picking one option.
function AskPlayerQuestionnaire({
  input,
  disabled,
  onAnswer,
}: {
  input: AskPlayerTool["input"]
  disabled: boolean
  onAnswer: (answer: AskPlayerTool["output"]) => void
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const id = new FormData(event.currentTarget).get("answer")
    const option = input.options.find((option) => option.id === id)

    if (option) {
      onAnswer({ id: option.id, label: option.label })
    }
  }

  return (
    <Questionnaire
      onSubmit={handleSubmit}
      shortcuts="numbers"
      className="rounded-xl border p-4"
    >
      <QuestionnaireItem name="answer" required disabled={disabled}>
        <QuestionnaireTitle>{input.question}</QuestionnaireTitle>
        <QuestionnaireChoices>
          {input.options.map((option) => (
            <QuestionnaireChoice key={option.id} value={option.id}>
              {option.label}
              <QuestionnaireChoiceDescription>
                {option.description}
              </QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnaireSubmit disabled={disabled}>Answer</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  )
}

// An answered ask_player question, with the option the player picked.
function AskPlayerAnswer({
  question,
  answer,
}: {
  question: string
  answer: AskPlayerTool["output"]
}) {
  return (
    <Marker>
      <MarkerIcon>
        <CheckIcon />
      </MarkerIcon>
      <MarkerContent>
        {question}
        <span className="ml-1.5 font-medium text-foreground">
          {answer.label}
        </span>
      </MarkerContent>
    </Marker>
  )
}

export function ChatThread({
  id,
  initialMessages,
  initialSession,
  initialModelId = DEFAULT_GAME_MODEL_ID,
  onTurnComplete,
}: ChatThreadProps) {
  const [input, setInput] = useState("")
  const [modelId, setModelId] = useState(initialModelId)
  const { setBalance } = useCreditBalance()
  // Set when a request is turned away because the org is out of credits. The
  // ref is for useChat's callbacks, so they always read the current value.
  const [isOutOfCredits, setIsOutOfCredits] = useState(false)
  const isOutOfCreditsRef = useRef(false)

  function showOutOfCredits(value: boolean) {
    isOutOfCreditsRef.current = value
    setIsOutOfCredits(value)
  }

  // Set when the agent streams the start of a reply. Reconnecting to a settled
  // chat on load replays the last turn-complete with nothing before it, and
  // that one isn't a new turn.
  const hasStreamedReply = useRef(false)

  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    // An org out of credits gets no session (lib/games/actions.ts).
    startSession: async ({ chatId, clientData }) => {
      const session = await startChatSession({ chatId, clientData })

      if ("outOfCredits" in session) {
        showOutOfCredits(true)
        throw new Error(OUT_OF_CREDITS_ERROR)
      }

      return session
    },
    // Sent with every message, so each reply uses the model picked when it was
    // requested (see trigger/chat.ts).
    clientData: { model: modelId },
    sessions: initialSession && { [id]: initialSession },
    onEvent: (event) => {
      if (event.type === "first-chunk") {
        hasStreamedReply.current = true
      } else if (event.type === "turn-completed" && hasStreamedReply.current) {
        hasStreamedReply.current = false
        onTurnComplete?.()
      }
    },
  })
  // What useChat talks to: the transport, with each new turn's stream cut to
  // the turn's own chunks, and a resumed reply kept whole. Stopping still goes
  // through the transport itself.
  const chatTransport = useMemo<ChatTransport<UIMessage>>(
    () => ({
      sendMessages: async (options) =>
        fromTurnStart(await transport.sendMessages(options)),
      reconnectToStream: async (options) => {
        const stream = await transport.reconnectToStream(options)
        return stream && withSavedReply(stream, initialMessages.at(-1))
      },
    }),
    [transport, initialMessages]
  )
  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    addToolOutput,
    status,
    error,
  } = useChat({
    id,
    messages: initialMessages,
    transport: chatTransport,
    // Pick up a reply that was still streaming when the page was reloaded.
    resume: initialSession !== undefined,
    // Once the player answers every pending question, continue the reply.
    // Not after a turn turned away for credits: the thread still ends in the
    // answered question, and sending it again would only be turned away again.
    sendAutomaticallyWhen: (options) =>
      !isOutOfCreditsRef.current &&
      lastAssistantMessageIsCompleteWithToolCalls(options),
    // The agent sends the org's new balance after each step it charges, and
    // turns a request away when the org is out of credits (trigger/chat.ts).
    onData: (part) => {
      if (part.type === "data-balance" && typeof part.data === "number") {
        setBalance(part.data)
      } else if (part.type === "data-out-of-credits") {
        showOutOfCredits(true)
      }
    },
    // The thread only says "Something went wrong". A failed turn is also
    // reported by the agent (trigger/chat.ts); this covers the rest, like a
    // token or connection failure.
    onError: (error) => {
      if (error.message === OUT_OF_CREDITS_ERROR) return

      Sentry.logger.error("Game chat error", {
        "game.id": id,
        "exception.message": error.message,
      })
    },
  })

  // A thread ending in a user message has no reply yet (e.g. the prompt saved
  // by createGame), so request one. The ref stops Strict Mode's double effect
  // from sending it twice. A resumed session is already answering it.
  const hasRequestedReply = useRef(false)

  useEffect(() => {
    if (hasRequestedReply.current) return
    hasRequestedReply.current = true

    if (initialMessages.at(-1)?.role === "user" && !initialSession) {
      regenerate()
    }
  }, [initialMessages, initialSession, regenerate])

  const isPending = status === "submitted" || status === "streaming"

  // The player answers a question in the thread. A new message would leave it
  // unanswered, which the model can't continue from.
  const isAwaitingPlayer = isAwaitingAnswer(messages.at(-1))

  function handleSubmit(value: string) {
    showOutOfCredits(false)
    sendMessage({ text: value })
    setInput("")
  }

  // useChat's stop() only closes the local stream, and after a resume it never
  // reaches the agent, so also tell the run to abort its reply.
  function handleStop() {
    transport.stopGeneration(id)
    stop()
  }

  return (
    <div className="flex h-full flex-col">
      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1
                // Only the last message can still be streaming. A tool call
                // left without a result anywhere else was cut short (e.g. by
                // stop or a failed turn).
                const isStreaming = status === "streaming" && isLast

                // A turn turned away for credits writes no reply; don't show
                // an empty one.
                if (
                  message.role === "assistant" &&
                  message.parts.every((part) => part.type === "step-start")
                ) {
                  return null
                }

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    {message.role === "assistant" ? (
                      <Message>
                        <MessageAvatar className="size-8">
                          <Image
                            src="/logo.svg"
                            alt="Assistant"
                            width={32}
                            height={32}
                          />
                        </MessageAvatar>
                        <MessageContent>
                          {message.parts.map((part, partIndex) => {
                            if (part.type === "text") {
                              return (
                                <Bubble key={partIndex} variant="ghost">
                                  <BubbleContent className="whitespace-pre-wrap">
                                    {part.text}
                                  </BubbleContent>
                                </Bubble>
                              )
                            }

                            if (isToolUIPart(part)) {
                              if (isAskPlayerPart(part)) {
                                if (part.state === "output-available") {
                                  return (
                                    <AskPlayerAnswer
                                      key={part.toolCallId}
                                      question={part.input.question}
                                      answer={part.output}
                                    />
                                  )
                                }

                                // Only the last message's question still waits
                                // on the player; it opens once the reply ends.
                                if (
                                  part.state === "input-available" &&
                                  isLast
                                ) {
                                  return (
                                    <AskPlayerQuestionnaire
                                      key={part.toolCallId}
                                      input={part.input}
                                      disabled={isPending}
                                      onAnswer={(answer) =>
                                        addToolOutput({
                                          tool: "ask_player",
                                          toolCallId: part.toolCallId,
                                          output: answer,
                                        })
                                      }
                                    />
                                  )
                                }
                              }

                              return (
                                <ToolCallMarker
                                  key={part.toolCallId}
                                  part={part}
                                  isStreaming={isStreaming}
                                />
                              )
                            }

                            return null
                          })}
                        </MessageContent>
                      </Message>
                    ) : (
                      <Message align="end">
                        <MessageContent>
                          <Bubble align="end" variant="secondary">
                            <BubbleContent className="whitespace-pre-wrap">
                              {message.parts.map((part, partIndex) =>
                                part.type === "text" ? (
                                  <span key={partIndex}>{part.text}</span>
                                ) : null
                              )}
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    )}
                  </MessageScrollerItem>
                )
              })}
              {error && !isOutOfCredits && (
                <Bubble variant="destructive">
                  <BubbleContent>
                    Something went wrong. Please try again.
                  </BubbleContent>
                </Bubble>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {/* Shaped like the composer below it, on the page background. */}
        {isOutOfCredits && (
          <div
            role="status"
            className="mb-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <p className="font-medium">Out of credits</p>
            <p className="text-muted-foreground">
              Building a game spends credits, and this organization has none
              left.{" "}
              <Link
                href="/billing"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Add more from the billing page
              </Link>{" "}
              to pick the game back up.
            </p>
          </div>
        )}
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          isPending={isPending}
          disabled={isAwaitingPlayer && !isPending}
          modelId={modelId}
          onModelChange={setModelId}
          placeholder={
            isAwaitingPlayer
              ? "Answer the question above to continue..."
              : "Ask for a change..."
          }
        />
      </div>
    </div>
  )
}
