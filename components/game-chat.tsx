"use client"

import type { ComponentProps } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type GameChatProps = ComponentProps<typeof ChatThread> & {
  // Only a game with a sandbox has something to preview.
  hasSandbox: boolean
}

export function GameChat({ hasSandbox, ...props }: GameChatProps) {
  if (!hasSandbox) {
    return <ChatThread {...props} />
  }

  return (
    <ResizablePanelGroup>
      <ResizablePanel>
        <ChatThread {...props} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPreview gameId={props.id} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
