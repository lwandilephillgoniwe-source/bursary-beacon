---
name: Verticals must be DB-enabled
description: opportunity_types.enabled=false blocks all routes for that vertical; must be set true in DB when activating a new vertical.
---

# Verticals must be DB-enabled

The route handlers in `artifacts/api-server/src/routes/pages.ts` query `opportunityTypesTable` with `eq(enabled, true)` before serving any page for a vertical (including the index, hub pages, and individual pages). If `enabled=false`, the route falls through to the next handler (or the 404 catch-all).

**Why:** The migration `0002_phase3.sql` inserts `learnership` with `enabled = false` as a safety default — so new verticals don't go live until intentionally enabled. But this must be flipped manually in the DB when you actually want the vertical live.

**How to apply:**
- When activating a new vertical after the migration, run:
  `UPDATE opportunity_types SET enabled = true WHERE type = 'learnership';`
- The sources-seed script does NOT manage the `enabled` flag; it's a one-time activation step.
- If a vertical page returns 404 unexpectedly, check `SELECT type, enabled FROM opportunity_types;` first.
