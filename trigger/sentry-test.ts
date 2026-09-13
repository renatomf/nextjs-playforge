import { task } from "@trigger.dev/sdk"

// Throws on purpose to check that task errors reach Sentry (trigger/init.ts).
// Run it from the Trigger.dev dashboard's Test page.
export const sentryErrorTest = task({
  id: "sentry-error-test",
  // Fail on the first attempt, so onFailure reports it right away.
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    const error = new Error("This is a custom error that Sentry will capture")
    error.cause = { additionalContext: "This is additional context" }
    throw error
  },
})
