"use client"

import { useState } from "react"
import Image from "next/image"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

type MockMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

const messages: MockMessage[] = [
  {
    id: "1",
    role: "user",
    content: "I want a retro space shooter where you defend a moon base.",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "Love it! I'll set up a top-down arena with the moon base in the center and enemy ships approaching from the edges. Should the player control a single turret or a ship that can fly around?",
  },
  {
    id: "3",
    role: "user",
    content: "A ship that can fly around, with a limited shield.",
  },
  {
    id: "4",
    role: "assistant",
    content:
      "Got it. Your ship now has a shield bar that drains on hits and slowly recharges when you avoid damage. If the shield breaks, the next hit costs a life.",
  },
  {
    id: "5",
    role: "user",
    content: "Can enemies come in waves that get harder over time?",
  },
  {
    id: "6",
    role: "assistant",
    content:
      "Done! Each wave spawns more ships and adds a new enemy type every third wave: scouts, then bombers, then shielded cruisers. There's a short break between waves to repair the base.",
  },
  {
    id: "7",
    role: "user",
    content: "Perfect. Add a pixel-art look and a synthwave soundtrack.",
  },
  {
    id: "8",
    role: "assistant",
    content:
      "Switched everything to a 16-color pixel palette with CRT scanlines, and added a looping synthwave track that speeds up during boss waves. Ready to play!",
  },
]

export function ChatThread() {
  const [input, setInput] = useState("")

  // Temporary: will be replaced by a real call to the chat API.
  function sendMessage(value: string) {
    console.log(value)
    setInput("")
  }

  return (
    <div className="flex h-svh flex-col">
      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.map((message) => (
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
                          <BubbleContent>{message.content}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end" variant="secondary">
                          <BubbleContent>{message.content}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={sendMessage}
          placeholder="Ask for a change..."
        />
      </div>
    </div>
  )
}
