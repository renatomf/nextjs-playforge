import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://3969a850e627a75169a6ab9822662fec@o4510082957180928.ingest.us.sentry.io/4512079832219648",

  // Set per deploy (e.g. "production" on Railway); unset, the SDK picks one
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,

  // Sends events through the app (app/monitoring/route.ts) to get around ad-blockers
  tunnel: "/monitoring",

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [Sentry.replayIntegration()],
})

// Instruments App Router navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
