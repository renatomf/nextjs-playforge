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
  // The one element with a fixed height: the thread and preview fill it, so a
  // long conversation scrolls inside the message scroller, not the page.
  return (
    <div className="h-svh">
      {hasSandbox ? (
        <ResizablePanelGroup>
          <ResizablePanel>
            <ChatThread {...props} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <ChatPreview gameId={props.id} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <ChatThread {...props} />
      )}
    </div>
  )
}
