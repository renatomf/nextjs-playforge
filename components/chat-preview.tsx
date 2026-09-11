"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"

type Preview =
  | { status: "loading" }
  | { status: "ready"; url: string; revision: number }
  | { status: "error" }

type ChatPreviewProps = {
  gameId: string
  // Goes up each time the agent finishes a turn, to reload the preview.
  revision: number
}

export function ChatPreview({ gameId, revision }: ChatPreviewProps) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" })

  useEffect(() => {
    // Strict Mode runs this effect twice; only the live one may set state.
    let ignore = false

    // Asks for the url again on every revision: a signed url expires, and the
    // route restarts the game server if the sandbox stopped. The current
    // preview stays up until the new one is ready.
    async function loadPreview() {
      const response = await fetch(`/api/games/${gameId}/preview`)

      if (!response.ok) {
        throw new Error(`Preview request failed: ${response.status}`)
      }

      const { url }: { url: string } = await response.json()

      if (!ignore) setPreview({ status: "ready", url, revision })
    }

    loadPreview().catch(() => {
      if (!ignore) setPreview({ status: "error" })
    })

    return () => {
      ignore = true
    }
  }, [gameId, revision])

  if (preview.status === "ready") {
    return (
      <iframe
        // Daytona can hand back the same url after an update, and an unchanged
        // src doesn't reload the iframe, so a new revision remounts it.
        key={preview.revision}
        src={preview.url}
        title="Game preview"
        className="h-full w-full border-0"
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {preview.status === "loading" ? (
        <Spinner className="size-6" />
      ) : (
        <p>The preview couldn&apos;t be loaded.</p>
      )}
    </div>
  )
}
