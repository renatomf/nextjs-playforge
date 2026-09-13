"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"

// How often the game is asked for its first error; lib/games/runtime/report.js
// answers each game-ping with a game-status.
const PING_INTERVAL_MS = 2000

type GameStatus = { type: "game-status"; error: string | null }

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
  const frameRef = useRef<HTMLIFrameElement>(null)

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

    loadPreview().catch((error: unknown) => {
      if (ignore) return

      setPreview({ status: "error" })
      // The route's own crashes reach Sentry as errors; this also catches a
      // 404 or a dropped connection, which leave the player without a preview.
      Sentry.logger.error("Game preview failed to load", {
        "game.id": gameId,
        "game.revision": revision,
        "exception.message":
          error instanceof Error ? error.message : String(error),
      })
    })

    return () => {
      ignore = true
    }
  }, [gameId, revision])

  // Polls the game for errors and logs the first one to Sentry. The game keeps
  // answering with that same error, so polling stops once it has one; a new
  // revision remounts the iframe and starts over.
  useEffect(() => {
    const frame = frameRef.current
    if (preview.status !== "ready" || !frame) return

    // The signed url carries its token in the host, so the origin is also
    // stripped from the error's stack before it's logged.
    const origin = new URL(preview.url).origin

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return

      const data = event.data as Partial<GameStatus> | null
      if (data?.type !== "game-status" || typeof data.error !== "string") return

      stop()
      const error = data.error.replaceAll(origin, "")
      Sentry.logger.error("Game preview error", {
        "game.id": gameId,
        "game.revision": preview.revision,
        "exception.message": error.split("\n")[0],
        "exception.stacktrace": error,
      })
    }

    const ping = () =>
      frame.contentWindow?.postMessage({ type: "game-ping" }, origin)

    window.addEventListener("message", onMessage)
    const timer = window.setInterval(ping, PING_INTERVAL_MS)

    const stop = () => {
      window.clearInterval(timer)
      window.removeEventListener("message", onMessage)
    }

    return stop
  }, [gameId, preview])

  if (preview.status === "ready") {
    return (
      <iframe
        ref={frameRef}
        // Daytona can hand back the same url after an update, and an unchanged
        // src doesn't reload the iframe, so a new revision remounts it.
        key={preview.revision}
        src={preview.url}
        title="Game preview"
        // The preview is cross-origin, so these need explicit permission:
        // gamepads, fullscreen, and sound before the first click.
        allow="autoplay; fullscreen; gamepad"
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
