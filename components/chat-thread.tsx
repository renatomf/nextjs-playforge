"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"

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

type ChatThreadProps = {
  id: string
  initialMessages: UIMessage[]
}

export function ChatThread({ id, initialMessages }: ChatThreadProps) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, regenerate, status, error } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      // The server loads the saved thread, so only send the new message. A
      // regenerate replies to the saved thread as-is, so it sends none.
      prepareSendMessagesRequest: ({ id, messages, trigger }) => ({
        body:
          trigger === "submit-message"
            ? { id, message: messages[messages.length - 1] }
            : { id },
      }),
    }),
  })

  // A thread ending in a user message has no reply yet (e.g. the prompt saved
  // by createGame), so request one. The ref stops Strict Mode's double effect
  // from sending it twice.
  const hasRequestedReply = useRef(false)

  useEffect(() => {
    if (hasRequestedReply.current) return
    hasRequestedReply.current = true

    if (initialMessages.at(-1)?.role === "user") {
      regenerate()
    }
  }, [initialMessages, regenerate])

  const isPending = status === "submitted" || status === "streaming"

  function handleSubmit(value: string) {
    sendMessage({ text: value })
    setInput("")
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
          isPending={isPending}
          placeholder="Ask for a change..."
        />
      </div>
    </div>
  )
}
