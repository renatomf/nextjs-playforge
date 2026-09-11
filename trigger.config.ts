import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_idhywzazknmimwoeeklp",
  runtime: "node-24",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    // Tasks share lib/ with the Next.js server, whose modules import
    // "server-only"; this condition resolves it to its no-op build.
    conditions: ["react-server"],
  },
});
