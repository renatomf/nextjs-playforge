// The browser SDK's tunnel (tunnel: "/monitoring" in instrumentation-client.ts),
// so ad blockers don't drop its events. Only the envelope is forwarded: a
// rewrite would also pass along the browser's cookies, which include the Clerk
// session and which Sentry's ingest rejects once they grow large.

// The client's DSN; envelopes for any other project are refused, so the route
// can't relay to someone else's Sentry.
const dsn = new URL(
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://3969a850e627a75169a6ab9822662fec@o4510082957180928.ingest.us.sentry.io/4512079832219648"
)
const projectId = dsn.pathname.slice(1)

// Sentry's answers the SDK reads to back off when it's rate-limited.
const FORWARDED_HEADERS = ["x-sentry-rate-limits", "retry-after"]

export async function POST(request: Request) {
  const envelope = new Uint8Array(await request.arrayBuffer())

  // The first line is the envelope header: JSON with the DSN it was made for.
  // The rest can be binary (compressed replays), so only that line is decoded.
  const headerEnd = envelope.indexOf(0x0a)
  let envelopeDsn: URL
  try {
    const header = JSON.parse(
      new TextDecoder().decode(
        envelope.subarray(0, headerEnd === -1 ? undefined : headerEnd)
      )
    )
    envelopeDsn = new URL(header.dsn)
  } catch {
    return new Response("Invalid envelope", { status: 400 })
  }

  if (
    envelopeDsn.hostname !== dsn.hostname ||
    envelopeDsn.pathname.slice(1) !== projectId
  ) {
    return new Response("Unknown DSN", { status: 400 })
  }

  const response = await fetch(
    `https://${dsn.hostname}/api/${projectId}/envelope/`,
    {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: envelope,
    }
  )

  const headers = new Headers()
  for (const name of FORWARDED_HEADERS) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new Response(response.body, { status: response.status, headers })
}
