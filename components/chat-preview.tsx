"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"

type Preview =
  { status: "loading" } | { status: "ready"; url: string } | { status: "error" }

export function ChatPreview({ gameId }: { gameId: string }) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" })

  useEffect(() => {
    // Strict Mode runs this effect twice; only the live one may set state.
    let ignore = false

    async function loadPreview() {
      const response = await fetch(`/api/games/${gameId}/preview`)

      if (!response.ok) {
        throw new Error(`Preview request failed: ${response.status}`)
      }

      const { url }: { url: string } = await response.json()

      if (!ignore) setPreview({ status: "ready", url })
    }

    loadPreview().catch(() => {
      if (!ignore) setPreview({ status: "error" })
    })

    return () => {
      ignore = true
    }
  }, [gameId])

  if (preview.status === "ready") {
    return (
      <iframe
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
