# Bursary Beacon — SA Opportunity Intelligence Platform

SEO-driven site publishing verified South African bursary/learnership pages that beat the original advert, kept fresh by scheduled re-checks against official sources. Master brief: `attached_assets/master-brief-for-replit_1785923626403.md`.

## Current status
Phase 1 (bursaries end-to-end) complete: Tier-1 collectors, AI extraction (HTML + PDF via vision), checklist confidence + publish gate, duplicate detection, AI enrichment, admin review view, public /bursaries index, and the freshness loop (demonstrated auto-closing a genuinely expired bursary). Phase 0 foundations underneath.

## Where things live
- **Landing page** (`artifacts/web`): React/Vite SPA at `/` ("Bursary Beacon" brand — deep teal / warm gold / cream, Bricolage Grotesque + DM Sans). Links to opportunity pages with plain `<a>` tags (server routes, not SPA routes).
- **Opportunity pages** (`artifacts/api-server`): Express serves full SSR HTML at `/<urlPrefix>/<slug>` (e.g. `/bursaries/sasol-foundation-bursary-2027`) — meta, OG, canonical, JSON-LD all in raw HTML. Renderer: `src/lib/renderOpportunity.ts`, route: `src/routes/pages.ts`. Artifact toml paths include `/bursaries`, `/learnerships`, `/internships`, `/jobs`.
- **DB schema** (`lib/db/src/schema/`): `opportunities` (facts vs AI content kept in separate columns by design), `opportunity_types` (config-driven verticals — new vertical = insert row + enable), `heartbeats`.
- **Scripts** (`scripts/src/`): `seed.ts`, `heartbeat.ts`, `sources-seed.ts` (Tier-1 source registry), `collect.ts` (fetch → snapshot → AI extract → score → dedupe → enrich → gate), `recheck.ts` (freshness loop; the intended daily Scheduled Deployment job — closes past-deadline/removed adverts, re-drafts changed sources, updates last_confirmed_at). Run via `pnpm --filter @workspace/scripts run sources-seed|collect|recheck` (recheck accepts `--force` to ignore cadence).
- **Pipeline internals** (`scripts/src/pipeline/`): `util.ts` (robots.txt check, hashing, link check, dedupe key), `fetchSource.ts`, `ai.ts` (OpenAI via Replit AI integration, model gpt-5.6-terra, Responses API; results cached in `ai_extractions` by content-hash + prompt version), `score.ts` (transparent checklist confidence: 4 checks × 25 pts, breakdown stored; missing closing date forces "low"; low never publishes). Prompts are versioned files in `scripts/prompts/` (current: extract-v2, enrich-v1) — behaviour changes require a NEW prompt version file or the cache serves stale results.
- **Admin view** (`/admin`, `src/routes/admin.ts`): drafts w/ confidence breakdowns, duplicate approve/reject, published+closed lists, source registry health. Auth: `?key=<SESSION_SECRET>` or `x-admin-key` header (sets cookie). Noindex + blocked in `/robots.txt`. Draft pages are 404 publicly but previewable with the admin cookie (noindex).
- **New tables**: `sources` (collector registry), `source_snapshots` (fetch audit trail), `ai_extractions` (AI cache). `opportunities` gained checklist-confidence columns (`confidence_points/band/breakdown`), dedupe fields, `review_flags`, `ai_eligibility`, `source_name`.
- **Heartbeat endpoint**: `POST /api/internal/heartbeat` protected by `Authorization: Bearer <SESSION_SECRET>`; `GET /api/internal/heartbeats` lists recent rows.

## Key decisions
- SSR = plain Express HTML string rendering (no React SSR) — fastest, fully crawlable, View Source friendly.
- Unattended background jobs require a **Scheduled Deployment** (after publishing) running the heartbeat/re-check script; dev workspace sleeps when closed. Fallback: external cron hitting the protected endpoint.
- Facts (`extracted_facts`, requirements, dates) are stored separately from AI content (`ai_summary`, `ai_checklist`, `ai_faq`) and rendered visually distinct with labels.
- Statuses: draft | published | closed | archived; `state_history` jsonb is the audit trail.
- Confidence is a transparent CHECKLIST (integer points + stored breakdown + low/medium/high band), NOT a float — explicit user requirement.
- Publish gate: band medium/high AND no duplicate flag AND no review flags; anything questionable stays Draft for admin review ("rather a Draft than a wrong published fact").
- Duplicate detection: exact normalised org+title+closing-date key, plus near-match on org + closing date; near-matches are drafted and flagged for the founder to approve/reject in /admin.
- Freshness loop cadence: weekly normally, daily in the final week before closing; deadline passed or source 404/410 → auto-closed (page stays up with Closed banner); content hash changed → back to Draft; transient fetch errors never close a record.
- **Phase 2 complete** (monetise + grow content): trust pages, analytics plumbing, affiliate links, hub pages, sitemap, 12 new sources, mobile-responsive CSS, dead code removed.

## User preferences
- User is a non-technical founder; communicate in plain language, product outcomes first.
- Work strictly phase-by-phase; stop at each phase gate for review.
- Keep review and publishing controls private inside the authenticated Admin area; do not expose Admin or Publish links in public navigation.
