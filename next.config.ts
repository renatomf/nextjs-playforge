import { withSentryConfig } from "@sentry/nextjs/config"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "ammodev",
  project: process.env.SENTRY_PROJECT ?? "sandbox",

  // Source map upload auth token (build-time secret, distinct from the DSN)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // No tunnelRoute: its rewrite forwards the browser's cookies to Sentry, which
  // rejects them once they grow large. app/monitoring/route.ts is the tunnel.

  // Only print source map upload logs in CI
  silent: !process.env.CI,
})
