import "server-only"

import { neon } from "@neondatabase/serverless"
import { parseEnv } from "@neon/env"
import { drizzle } from "drizzle-orm/neon-http"

import config from "@/neon"
import * as schema from "./schema"

// Pooled connection for app traffic; typed and validated against neon.ts.
const { postgres } = parseEnv(config, ["DATABASE_URL"])

export const db = drizzle({ client: neon(postgres.databaseUrl), schema })
