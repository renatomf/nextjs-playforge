import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

// Load .env* files the same way Next.js does (drizzle-kit runs outside Next).
loadEnvConfig(process.cwd())

// drizzle-kit must use the direct (non-pooled) connection: PgBouncer's
// transaction pooling breaks session-level operations it relies on.
const url = process.env.DATABASE_URL_UNPOOLED
if (!url) {
  throw new Error("DATABASE_URL_UNPOOLED is not set. Run `neon env pull`.")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
