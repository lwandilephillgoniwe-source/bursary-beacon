# PHASE 1 — ONE VERTICAL, END TO END (BURSARIES)
### Paste this to Replit after Phase 0 is done and I've approved it.

Phase 0 is approved. Now build **Phase 1 only** — get bursaries working end to end, from
source to a live, verified, self-updating page. Then stop and show me.

## Goal of Phase 1
Prove the whole machine works on **one vertical (bursaries)**: fetch → extract → enrich →
validate → publish → and keep re-checking. Quality over quantity — a small number of
excellent, accurate pages.

## Tasks

**1. Sourcing — build collectors for 5–10 Tier-1 bursary sources.**
Start narrow, done well. Use the three-layer approach, preferring the most automated:
- Layer 1: API/RSS where available.
- Layer 2: scheduled scrapers (main workhorse) for stable public pages — e.g. NSFAS, big
  corporate bursary pages (Sasol, Eskom, Transnet, Anglo American), a few university
  financial-aid pages.
- Store `official_source_url` with every record (needed for re-checking).
- Respect robots.txt / terms. We extract facts and add value; we do not clone pages.
- Normalise everything into the one common Opportunity format.

**2. AI extraction + image/PDF handling.**
- Add an AI extraction step: source content → structured facts (title, org, closing date,
  eligibility, documents, application link) as JSON, **with a confidence score** (defined
  in Task 4).
- Handle **image and PDF adverts** with a vision/OCR-capable model — a lot of SA bursaries
  are PDFs or images. Read them, then extract.
- Low extraction confidence → the record stays in **Draft** for my manual review.
- Version-control the prompts (store them as files/config). Cache results to control cost.
- NOTE: expect real PDF adverts to stress the schema. When a source doesn't fit the clean
  fields, flag it for me rather than forcing/guessing — we'd rather have a Draft than a
  wrong published fact.

**3. AI enrichment — make the page beat the source.**
For each record, generate: plain-English summary, "can I apply?" eligibility guidance,
document checklist, and FAQ. Prompt the AI to stay strictly accurate and **never invent**
anything beyond the source. Label all of this as AI help.

**4. Validation / publishing gate — and the two mechanics it depends on.**
Before anything publishes, it must pass a gate. Two pieces the gate needs, defined here so
they're not vague:

- **Confidence score** — a simple, transparent checklist score, not a black box. Award points
  for each of: closing date found and parseable to a real date; eligibility text extracted;
  a working official application link present; organisation identified. If the closing date
  is missing or unparseable, confidence is automatically "low" (a bursary with no reliable
  deadline is the most dangerous thing we can publish). Low confidence → stays in Draft.
- **Duplicate detection** — the same bursary often appears on a university page, a corporate
  page, and an aggregator. Normalise on `organisation + title + closing_date` (lowercased,
  trimmed) and flag near-matches into the admin view for me to merge/reject. Never publish
  two pages for the same opportunity.

The full gate, before publish:
- official source exists and is stored; closing date extracted with acceptable confidence;
  not a duplicate; facts and AI help clearly separated; page genuinely more useful than the
  source.
- Drafts are `noindex`. Only published pages are indexable.
- Publish ~20–30 excellent bursary pages this phase.

**5. The freshness loop — the most important part.**
Build scheduled background jobs (using whatever we settled on in Phase 0) that:
- Re-fetch each published record's source on a cadence (e.g. weekly normally, daily in the
  final week before closing).
- Compare `source_content_hash`; if the source changed → return record to **Draft** +
  re-validate.
- If the closing date passed or the advert was removed → auto-set status to `closed` (show a
  clear "Closed" state; don't leave dead links or delete the page).
- Update `last_confirmed_at` each time it confirms a record is still live.
- This runs on layers 1–2 only (unattended). The browser agent is never part of this loop.

**6. Basic admin view.**
A simple internal page where I can see Draft records, review low-confidence ones, review
flagged duplicates, approve/publish, and see each record's status and last-confirmed date.
(Keep admin `noindex` and blocked in robots.txt.)

## Stop here
Show me: the live bursary pages, the admin view, and proof the freshness loop runs on a
schedule and **correctly closes an expired record** (demonstrate it, don't just describe it).

**Do NOT start Phase 2 until I say so.**
