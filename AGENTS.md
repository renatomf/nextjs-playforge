<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database: use `db:push`, never migrations

This project is in development and has no backwards-compatibility requirements, so the database schema is synced directly from `lib/db/schema.ts`.

- **Always** apply schema changes with `npm run db:push` (`drizzle-kit push`).
- **Never** run `drizzle-kit migrate` or `drizzle-kit generate`, and do not add `db:migrate`/`db:generate` scripts back.
- Do not create or commit migration files (`drizzle/` folder, `drizzle.__drizzle_migrations` table).

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
