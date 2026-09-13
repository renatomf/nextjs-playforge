import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"

// Trigger.dev loads this file before running any task.
Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    "https://3969a850e627a75169a6ab9822662fec@o4510082957180928.ingest.us.sentry.io/4512079832219648",
  // Trigger.dev runs its own OpenTelemetry, which Sentry's default
  // integrations would clash with, so only report errors from here.
  defaultIntegrations: false,
  integrations: [
    // trigger/chat.ts can report a failed turn from two hooks: keep one event.
    Sentry.dedupeIntegration(),
    // Keep `error.cause` chains, e.g. provider errors wrapped by the AI SDK.
    Sentry.linkedErrorsIntegration(),
  ],
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    (process.env.NODE_ENV === "production" ? "production" : "development"),
  // Sends Sentry.logger.* calls from tasks and the lib/ code they share.
  enableLogs: true,
})

// Tags every log a run writes with the run, including the logs of the lib/
// code it calls. A worker process runs one run at a time, so the global scope
// belongs to this run.
tasks.onStartAttempt(({ ctx }) => {
  Sentry.getGlobalScope().setAttributes({
    "trigger.task": ctx.task.id,
    "trigger.run": ctx.run.id,
  })
})

// Fires once a run has used up its retries. A failed chat turn doesn't fail
// its run, so trigger/chat.ts reports those itself.
tasks.onFailure(async ({ ctx, error }) => {
  Sentry.captureException(error, {
    tags: {
      "trigger.task": ctx.task.id,
      "trigger.run": ctx.run.id,
      "trigger.environment": ctx.environment.type,
    },
  })
  // Send it before the run's process shuts down.
  await Sentry.flush(2000)
})
