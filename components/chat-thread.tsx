"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useChat } from "@ai-sdk/react"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { mintChatAccessToken, startChatSession } from "@/lib/games/actions"
import type { gameChat } from "@/trigger/chat"

type ChatThreadProps = {
  id: string
  initialMessages: UIMessage[]
  // The game's chat session, once it has one; lets a reload resume the stream.
  initialSession?: { publicAccessToken: string; lastEventId: string }
}

export function ChatThread({
  id,
  initialMessages,
  initialSession,
}: ChatThreadProps) {
  const [input, setInput] = useState("")
  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    sessions: initialSession && { [id]: initialSession },
  })
  const { messages, sendMessage, regenerate, stop, status, error } = useChat({
    id,
    messages: initialMessages,
    transport,
    // Pick up a reply that was still streaming when the page was reloaded.
    resume: initialSession !== undefined,
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
    <div className="flex h-svh flex-col">
      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.map((message) => {
                const content = message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <span key={index}>{part.text}</span>
                  ) : null
                )

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
                          <Bubble variant="ghost">
                            <BubbleContent className="whitespace-pre-wrap">
                              {content}
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    ) : (
                      <Message align="end">
                        <MessageContent>
                          <Bubble align="end" variant="secondary">
                            <BubbleContent className="whitespace-pre-wrap">
                              {content}
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
          placeholder="Ask for a change..."
        />
      </div>
    </div>
  )
}
