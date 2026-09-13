"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useChat } from "@ai-sdk/react"
import * as Sentry from "@sentry/nextjs"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type DynamicToolUIPart,
  type InferUITool,
  type ToolUIPart,
  type UIMessage,
} from "ai"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"

import { ChatComposer } from "@/components/chat-composer"
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
import type { askPlayer } from "@/lib/games/ask-player"
import { mintChatAccessToken, startChatSession } from "@/lib/games/actions"
import type { gameChat } from "@/trigger/chat"

type ChatThreadProps = {
  id: string
  initialMessages: UIMessage[]
  // The game's chat session, once it has one; lets a reload resume the stream.
  initialSession?: { publicAccessToken: string; lastEventId: string }
  // Called each time the agent finishes a turn that replied on this page.
  onTurnComplete?: () => void
}

type ToolCallState = "active" | "done" | "failed"

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
  onTurnComplete,
}: ChatThreadProps) {
  const [input, setInput] = useState("")

  // Set when the agent streams the start of a reply. Reconnecting to a settled
  // chat on load replays the last turn-complete with nothing before it, and
  // that one isn't a new turn.
  const hasStreamedReply = useRef(false)

  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
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
    transport,
    // Pick up a reply that was still streaming when the page was reloaded.
    resume: initialSession !== undefined,
    // Once the player answers every pending question, continue the reply.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // The thread only says "Something went wrong". A failed turn is also
    // reported by the agent (trigger/chat.ts); this covers the rest, like a
    // token or connection failure.
    onError: (error) => {
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
                                if (part.state === "input-available" && isLast) {
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
              {error && (
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
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          isPending={isPending}
          disabled={isAwaitingPlayer && !isPending}
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
