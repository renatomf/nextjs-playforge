<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database: use `db:push`, never migrations

This project is in development and has no backwards-compatibility requirements, so the database schema is synced directly from `lib/db/schema.ts`.

- **Always** apply schema changes with `npm run db:push` (`drizzle-kit push`).
- **Never** run `drizzle-kit migrate` or `drizzle-kit generate`, and do not add `db:migrate`/`db:generate` scripts back.
- Do not create or commit migration files (`drizzle/` folder, `drizzle.__drizzle_migrations` table).
