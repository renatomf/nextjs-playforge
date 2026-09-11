"use client"

import type { ComponentProps } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export function GameChat(props: ComponentProps<typeof ChatThread>) {
  return (
    <ResizablePanelGroup>
      <ResizablePanel>
        <ChatThread {...props} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPreview />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
