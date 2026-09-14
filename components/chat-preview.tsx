"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// How often the game is asked for its first error; lib/games/runtime/report.js
// answers each game-ping with a game-status.
const PING_INTERVAL_MS = 2000

// How long a page that doesn't answer a ping stays covered: Daytona's warning
// page, which needs a click, or a game that doesn't load report.js.
const REVEAL_FALLBACK_MS = 1500

// Behind the iframe and on its cover, so Daytona's unstyled pages (like the
// "Redirecting…" one after its warning is accepted) never flash white.
const PREVIEW_BACKGROUND = "bg-[#262624]"

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
  // The revision whose game has answered a ping. Any other revision's iframe
  // stays covered.
  const [shownRevision, setShownRevision] = useState<number | null>(null)
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

  // Covers each page the iframe loads until the game answers a ping, and logs
  // the game's first error to Sentry. The game keeps answering with that same
  // error, so polling stops once it has one; a new revision remounts the
  // iframe and starts over.
  useEffect(() => {
    const frame = frameRef.current
    if (preview.status !== "ready" || !frame) return

    // The signed url carries its token in the host, so the origin is also
    // stripped from the error's stack before it's logged.
    const origin = new URL(preview.url).origin
    let revealTimer: number | undefined
    let logged = false

    const reveal = () => {
      window.clearTimeout(revealTimer)
      setShownRevision(preview.revision)
    }

    const ping = () =>
      frame.contentWindow?.postMessage({ type: "game-ping" }, origin)

    // Daytona serves its warning and redirect pages from the game's origin,
    // so a load can be any of them; only the game answers the ping.
    const onLoad = () => {
      setShownRevision(null)
      window.clearTimeout(revealTimer)
      revealTimer = window.setTimeout(reveal, REVEAL_FALLBACK_MS)
      ping()
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return

      const data = event.data as Partial<GameStatus> | null
      if (data?.type !== "game-status") return

      reveal()

      if (typeof data.error !== "string" || logged) return

      logged = true
      window.clearInterval(pingTimer)
      const error = data.error.replaceAll(origin, "")
      Sentry.logger.error("Game preview error", {
        "game.id": gameId,
        "game.revision": preview.revision,
        "exception.message": error.split("\n")[0],
        "exception.stacktrace": error,
      })
    }

    window.addEventListener("message", onMessage)
    frame.addEventListener("load", onLoad)
    const pingTimer = window.setInterval(ping, PING_INTERVAL_MS)
    // In case the first page loaded before this effect could see it.
    revealTimer = window.setTimeout(reveal, REVEAL_FALLBACK_MS)

    return () => {
      window.clearInterval(pingTimer)
      window.clearTimeout(revealTimer)
      window.removeEventListener("message", onMessage)
      frame.removeEventListener("load", onLoad)
    }
  }, [gameId, preview])

  if (preview.status === "ready") {
    return (
      <div className={cn("relative h-full", PREVIEW_BACKGROUND)}>
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
          // Daytona's redirect page sets no color scheme. Under the app's dark
          // theme that mismatch makes the browser paint it on opaque white; a
          // matching light scheme leaves it transparent over the background.
          style={{ colorScheme: "light" }}
          className="h-full w-full border-0"
        />
        {shownRevision !== preview.revision && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              PREVIEW_BACKGROUND
            )}
          >
            <Spinner className="size-6 text-neutral-400" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-sm text-neutral-400",
        PREVIEW_BACKGROUND
      )}
    >
      {preview.status === "loading" ? (
        <Spinner className="size-6" />
      ) : (
        <p>The preview couldn&apos;t be loaded.</p>
      )}
    </div>
  )
}
