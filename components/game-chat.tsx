"use client"

import { useState, type ComponentProps } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type GameChatProps = Omit<
  ComponentProps<typeof ChatThread>,
  "onTurnComplete"
> & {
  // Only a game with a sandbox has something to preview.
  hasSandbox: boolean
}

export function GameChat({ hasSandbox, ...props }: GameChatProps) {
  // Counts the agent's finished turns; the preview reloads on each one.
  const [previewRevision, setPreviewRevision] = useState(0)

  // A new game gets its sandbox during its first turn, so a finished turn
  // means there is something to preview.
  const showPreview = hasSandbox || previewRevision > 0

  // The one element with a fixed height: the thread and preview fill it, so a
  // long conversation scrolls inside the message scroller, not the page.
  // Always a panel group, so the thread stays mounted (and keeps its messages)
  // when the preview appears.
  return (
    <div className="h-svh">
      <ResizablePanelGroup>
        <ResizablePanel id="thread">
          <ChatThread
            {...props}
            onTurnComplete={() =>
              setPreviewRevision((revision) => revision + 1)
            }
          />
        </ResizablePanel>
        {showPreview && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel id="preview">
              <ChatPreview gameId={props.id} revision={previewRevision} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
