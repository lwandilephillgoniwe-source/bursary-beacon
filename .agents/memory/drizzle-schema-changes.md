---
name: Drizzle schema changes
description: How to change the Postgres schema in this repo without breaking push or deploys
---
Rule: for column removals/renames, run the destructive SQL manually first (psql), then `pnpm --filter @workspace/db run push`. The checked-in migration in `lib/db/migrations/` must stay idempotent (CREATE TABLE IF NOT EXISTS + ADD/DROP COLUMN IF EXISTS).

**Why:** `drizzle-kit push` opens an interactive rename prompt in non-TTY shells and hangs; and the dev DB was originally created via push with no migration journal, so the journaled migration must work on both fresh and push-created databases (verified against both in Aug 2026).

**How to apply:** any schema change → update schema files, handle destructive bits via SQL, push, then regenerate/extend the idempotent migration and run `pnpm --filter @workspace/db run migrate` to confirm it no-ops cleanly.
