# PHASE 0 — FOUNDATIONS
### Paste this to Replit AFTER you've pasted the master brief. Do this phase ONLY.

I've given you the master brief for the whole project — read it for full context, but
**we build in phases and you must not build ahead.** Right now, complete **Phase 0 only**,
then stop and show me the result.

## Goals of Phase 0
Get the foundation right. Everything else sits on this, so don't rush it. There are **two
make-or-break checks** in this phase (rendering and background jobs). Settle both before
building anything else — if either fails, tell me the fix and stop.

## Tasks

**1. Rendering check (do this first).**
Confirm this Replit setup can deliver **server-side rendered (SSR) or statically generated**
pages. The opportunity content must be present in the **raw HTML on first load** — testable
with "View Source" — not injected by JavaScript afterwards. Google indexes client-only
content poorly, and this is an SEO-critical site.
- Tell me plainly: do we have SSR/SSG here? If not, what stack/change do you recommend to
  get it? Don't proceed to templates until this is settled.

**2. Background-job check (equally important — do this second).**
The entire product depends on a "freshness loop" that re-checks opportunity sources on a
schedule, unattended, forever. Before we build anything that relies on it, prove this setup
can actually run a scheduled job on its own.
- Build a trivial test job that writes a timestamp to the database every few minutes.
- Confirm it keeps running when I'm not looking at the project (i.e. after the editor tab is
  closed / the app would normally sleep).
- Tell me plainly: can a scheduled background job run unattended here? If not, recommend the
  fix (e.g. a Reserved VM / Scheduled Deployment, or an external cron such as GitHub Actions
  or cron-job.org hitting a protected endpoint on our site). Don't proceed until this is
  settled.

**3. Project skeleton + hosting basics.**
- Set up the project structure.
- Prepare for a **custom domain** (not a builder subdomain) and **HTTPS**.
- Set up a place for environment variables / secrets (we'll add AI API keys later).

**4. Database schema — the Opportunity record.**
Create the schema with these fields, designed so adding a new vertical later is a
**config change, not a rebuild**:
- `id`, `slug`, `type` (bursary | learnership | internship | job)
- `title`, `organisation`, `province`/`location`, `field_of_study`/`industry`
- `official_source_url` (required), `official_application_url`
- `closing_date`, `closing_date_confidence`, `is_rolling`, `opens_date`
- `eligibility`, `requirements`, `required_documents[]`
- `extracted_facts` vs `ai_summary`, `ai_checklist`, `ai_faq`
- `status` (draft | published | closed | archived)
- `confidence_score`, `last_fetched_at`, `last_confirmed_at`, `source_content_hash`
- `seo_title`, `meta_description`, `schema_json`
- `created_at`, `updated_at`, `state_history[]`

**5. One opportunity page template + one live example.**
Build a single opportunity page template that renders, in order: H1 title; at-a-glance facts
box (org, closing date, location, field, who can apply); plain-English summary (labelled AI
help); eligibility; required documents; how to apply; deadline + "Last confirmed open on
[date]"; official source attribution + official application link; FAQ; related opportunities.
- Facts and AI help must be **visually distinct**.
- Add **structured data** (JobPosting-style schema for learnership/job types; appropriate
  schema for bursaries), unique `<title>` + meta description, one H1, logical H2s,
  self-referencing canonical, Open Graph tags.
- Use a **clean permanent URL**: `/bursaries/example-bursary-2027` (lowercase, hyphens,
  no IDs).
- Populate it with **one hand-entered example bursary** so I can see a real page live.

## Stop here
When done, show me:
- Whether we have SSR (and your recommendation if not).
- Whether a scheduled background job runs unattended (and your recommendation if not).
- The live example page URL.
- Confirmation the opportunity content appears in View Source.

**Do NOT start Phase 1 until I say so.**
