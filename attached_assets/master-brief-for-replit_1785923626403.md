# MASTER BUILD BRIEF — South African Opportunity Intelligence Platform
### Background + execution plan for Replit (and for me, the founder)

> **How to use this document:** This is the single source of truth for the whole project. Read the whole thing once for context, then build in the order given under **PART 12 — Execution Roadmap**. Do not build everything at once. Ship the smallest working slice first, then grow.

---

## PART 0 — The honest reality (read this first)

This is a real, buildable business. It is **not** fast money. Income comes from search traffic, and search traffic compounds slowly over months as Google learns to trust the site. Expect little in month 1–3, meaningful traffic in month 6+, and real momentum from a full year of consistent, quality publishing. Do not spend money you can't afford to lose, and don't quit anything to chase it. Treat it as an asset you're building that pays more each month if you keep it accurate and keep publishing.

The whole business rests on **one promise**: *every page on our site is more accurate, clearer, and more useful than the original advert.* If we ever break that promise to publish faster, Google removes us and users stop trusting us. Quality is not a nice-to-have here — it is the entire moat and the only protection against Google's spam/AI-content penalties.

---

## PART 1 — What we are building (in one paragraph)

A South African website that publishes **bursaries and learnerships** (launch focus), where each opportunity gets its own clean, verified, easy-to-understand page. We don't just copy the advert — we extract the facts, keep them current by continuously re-checking the official source, explain them in plain language, and always link out to the official application. Over time we add internships and entry-level jobs. The system is built to handle **all opportunity types from day one**, but we **launch and focus on bursaries first** to earn Google's trust on one topic fast.

---

## PART 2 — The money model (why the build serves income)

Income = **traffic × revenue-per-visitor**. Every build decision must respect both.

**Layer 1 — Display ads (Google AdSense).** The baseline. Realistic for this audience/niche is a low RPM (roughly a couple of dollars per 1,000 pageviews), so this only matters at volume. It requires AdSense approval, which requires genuinely original, useful pages (see Part 8).

**Layer 2 — Affiliate / referral (higher value).** Links to CV-writing services, online courses, laptop deals, etc., placed *helpfully* (e.g. "you'll need these documents / a good CV"). Higher value per click than display ads.

**Layer 3 — Education-provider lead-gen (highest value, later).** Private colleges and universities pay for qualified student interest. This is the real upside and it grows naturally out of the bursary/course audience. Build toward it; don't chase it at launch.

**Rule for the build:** prioritise publishing opportunity categories that have **real SA search demand** (big named bursaries — Sasol, Eskom, Transnet, Anglo American, SAICA Thuthuka, NSFAS, etc.) over obscure ones nobody searches for. A perfectly verified page nobody finds earns R0.

---

## PART 3 — Core principles (guardrails — never break these)

1. **The official source is always the source of truth.** We verify and explain; we never invent facts or guarantee outcomes.
2. **Every page must beat the original advert** — clearer, more complete, easier. If a page can't add real value, don't publish it.
3. **Separate facts from AI help.** Extracted facts (dates, requirements, links) are shown distinctly from AI-generated summaries/guidance, and AI help is labelled as such.
4. **Never claim "verified" on something a human didn't check.** Our honest, marketable claim is **"continuously checked against the official source"** + a *last-confirmed date*. That's true and still a strong trust signal.
5. **Always link out to the official application.** We are never the dead end.
6. **Freshness over volume.** A dead link or an expired closing date destroys trust faster than ten new pages build it.
7. **Never publish thin AI content at scale.** That is exactly what Google's 2026 updates penalise. Quality gate before every publish.

---

## PART 4 — How the system works (the freshness loop)

This is a **loop, not a line.** It never "ends" at published.

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
        ▼                                                         │
  1. DISCOVER ──► 2. FETCH ──► 3. EXTRACT ──► 4. ENRICH ──► 5. VALIDATE ──► 6. PUBLISH
  (find new         (get raw     (AI pulls     (AI writes    (quality gate)   (live page,
   opportunities)    content)     structured    plain-Eng.                     indexable)
                                  facts)        summary,                          │
                                                checklist)                        │
                                                                                  ▼
                                                            7. RE-CHECK ON SCHEDULE
                                                            (is it still live? date changed?)
                                                                   │
                                          ┌────────────────────────┼───────────────────────┐
                                          ▼                        ▼                        ▼
                                    STILL VALID              CHANGED                    EXPIRED/GONE
                                 (update last-confirmed)  (return to Draft,          (mark "Closed",
                                          │                re-validate)               noindex or archive)
                                          └────────────────► back into the loop ◄──────────┘
```

**The re-check step (7) is the heart of the business.** It's what keeps dates accurate and links alive without a human checking every record. Build the loop first-class, not as an afterthought.

---

## PART 5 — Data model (the Opportunity record)

One flexible record type handles all verticals. Key fields:

- `id`, `slug` (permanent URL slug), `type` (`bursary` | `learnership` | `internship` | `job`)
- `title`, `organisation`, `province`/`location`, `field_of_study` / `industry`
- `official_source_url` (**required** — used for re-checking)
- `official_application_url`
- `closing_date`, `closing_date_confidence` (0–1), `is_rolling` (bool)
- `opens_date`, `eligibility` (structured), `requirements`, `required_documents[]`
- `extracted_facts` (raw, from source) **vs** `ai_summary`, `ai_checklist`, `ai_faq` (labelled AI help)
- `status` (`draft` | `published` | `closed` | `archived`)
- `confidence_score` (overall), `last_fetched_at`, `last_confirmed_at`
- `source_content_hash` (to detect when the source page changes)
- SEO fields: `seo_title`, `meta_description`, `schema_json`
- Audit: `created_at`, `updated_at`, `state_history[]`

Design the schema so **adding a new vertical is a config change, not a rebuild.**

---

## PART 6 — Sourcing architecture (three layers)

Prefer the most automated layer available for each source.

**Layer 1 — API / RSS (best).** Fully automated on Replit, scheduled. Use wherever a source offers a feed.

**Layer 2 — Scheduled scraper (main workhorse).** For stable public pages. Runs unattended on Replit via cron. This covers most launch sources.

**Layer 3 — Browser agent (manual fallback only).** Claude Chrome extension / ChatGPT for awkward, JS-heavy, or blocked pages, and for *me* to discover and spot-check. **Never part of the automated loop** — it needs a human, so it can't power passive re-checking.

**Rules:** the automated freshness loop runs on layers 1–2 only. Always store `official_source_url` so any record can be re-checked. Everything normalises into the one common format regardless of layer. Respect robots.txt and terms; we take facts and add value, we don't clone pages.

### Starter sources for bursaries + learnerships (build collectors for these first)

**Tier 1 — official (source of truth):**
- NSFAS (nsfas.org.za) — the biggest government funder
- DHET (Dept of Higher Education & Training)
- The SETA websites — the official home of learnerships (there are 21 SETAs; e.g. SASSETA, MERSETA, etc.)
- Big corporate bursary pages: Sasol, Eskom, Transnet, Anglo American, ABSA, Investec
- SAICA Thuthuka, StudyTrust, IDC, CSIR, Allan Gray, Mandela Rhodes
- University financial-aid pages (UP, UJ, UWC, UKZN, Wits, UCT, etc.)

**Tier 2 — discovery only (find what exists, then go to the official source for facts):**
- The NSTF bursary-provider list (nstf.org.za) — one of the most comprehensive directories
- Existing aggregators (justbursaries, edufunds, zabursaries, bursariesafrica, gocareers) — **use to discover, never to copy.** These are mostly thin listing sites — that's the gap we beat with verification + freshness.

**Tier 3 — submissions:** a simple "submit an opportunity" form for orgs/users; everything submitted goes to Draft and must be verified before publishing.

---

## PART 7 — Verification & confidence engine

- **Extraction confidence:** when AI pulls the closing date/requirements, it returns a confidence score. Low confidence → record stays in Draft for manual review.
- **Re-check schedule:** re-fetch each published record's source on a cadence — more often as its closing date approaches (e.g. weekly normally, daily in the final week). Compare `source_content_hash`; if the page changed, return the record to Draft and re-validate.
- **Closing-date handling:** if the date passed, auto-flip to `closed`. If the source removed the advert, mark closed/archived, don't leave a dead page.
- **Overall confidence score:** combine extraction confidence + source reliability tier + recency of last confirmation. Show a human-readable version ("Last confirmed open on [date]").
- **Two-model check (optional, for high-value records):** have a second model re-read the source and confirm the extracted date. Cheap insurance on the pages that matter most.

---

## PART 8 — AI architecture (which model does what)

Use AI to **help users**, not to mass-produce text. Match the model to the job and cost.

- **Extraction (source → structured facts):** a strong, cheap model for structured JSON extraction. This is the highest-volume call — keep it cost-efficient.
- **PDF/scanned adverts:** many bursaries are PDFs. Use a document/OCR-capable model or an OCR step first, then extract.
- **Enrichment (plain-English summary, checklist, FAQ):** a capable model, prompted to be accurate and to *not invent* anything beyond the source.
- **Verification (optional second pass):** a second model confirms the closing date on high-value records.
- **Embeddings / vector search / RAG:** **not needed at launch.** Add later only if/when you build "related opportunities" or on-site semantic search at scale. Don't over-build early.

**Engineering rules:** version-control your prompts (store them, treat changes like code). Store the AI confidence score with each record. Cap costs by only calling the expensive models where they earn their keep (verification, PDFs), and cache results. Never let AI output publish without passing the validation gate.

**Provider note:** you can mix providers by task (cheapest good model for bulk extraction; a stronger one for enrichment/verification). Choose per cost + quality, not hype. All personal-data processing later (CVs) is a cross-border transfer — see Part 11.

---

## PART 9 — The page template (what makes each page beat the source)

Every opportunity page, in this order:

1. **Clear H1** — the opportunity title.
2. **At-a-glance box (extracted facts):** organisation, closing date, location, field, who can apply — the answers people came for, above the fold.
3. **Plain-English summary (labelled AI help).**
4. **Eligibility — can I realistically apply?** (labelled AI guidance, facts pulled from source.)
5. **Required documents** (checklist).
6. **How to apply, step by step.**
7. **Deadline + "Last confirmed open on [date]."**
8. **Official source attribution + official application link** (prominent).
9. **FAQ** (labelled AI help).
10. **Related opportunities** (internal links — same type/field/province).

Facts and AI help must be **visually distinct**. This template is what earns AdSense approval and Google trust, and it's the reason someone shares your page instead of the original PDF.

---

## PART 10 — SEO / Google trust (bake in from day one)

- **Rendering:** server-side rendered (SSR) or static — the opportunity details must be in the raw HTML on first load, not injected by JS. **Confirm Replit's setup delivers this** before building templates.
- **URLs:** clean, permanent, descriptive: `/bursaries/sasol-engineering-bursary-2027`. Lowercase, hyphens, no IDs. Never change a published URL — redirect if renamed.
- **Structured data:** JobPosting schema on learnership/internship/job pages; appropriate schema on bursary pages. `validThrough` must match the real closing date.
- **Meta:** unique title + meta description per page, one H1, logical H2s, self-referencing canonical, Open Graph tags.
- **Sitemap + robots:** auto-updating XML sitemap (adds each page on publish), submitted to Google Search Console; robots.txt allows published pages, blocks admin/draft; drafts are `noindex` until they pass the gate; expired pages show "Closed" status (don't just delete → no dead links).
- **Performance + mobile:** fast Core Web Vitals, sized images, mobile-first (most SA traffic is mobile).
- **Trust pages (Google's raters check for these):** About, Contact, Editorial policy, **AI usage policy** (state plainly what AI does and doesn't do), Privacy/POPIA. Organisation profile hub pages linking their opportunities.
- **Penalty safety:** publish more only by publishing *better* — never thin. This keeps you on the safe side of the scaled-content/AI updates.

---

## PART 11 — Privacy / POPIA (light now, serious before CVs)

At launch we publish public opportunities — minimal personal data, low risk. **Before** adding CV upload / matching tools:
- Explicit consent before processing CVs or academic records.
- Data minimisation — collect only what's needed.
- Encryption at rest + in transit; secure auth.
- User rights: data export + permanent deletion.
- **Cross-border processing:** sending CVs to US-based AI APIs is a cross-border transfer under POPIA — disclose it and handle lawfully.
- Audit logging + a POPIA-compliant privacy policy.

Don't collect sensitive financial info unless truly necessary.

---

## PART 12 — Execution roadmap (BUILD IN THIS ORDER)

**Phase 0 — Foundations (get this right, everything sits on it)**
1. Confirm Replit delivers SSR / crawlable HTML. Set up the project, custom domain, HTTPS, Google Search Console.
2. Build the database schema (Part 5) and the opportunity page template (Part 9) with structured data (Part 10). Render one page by hand end-to-end so you can see it live and indexable.

**Phase 1 — One vertical, end to end (bursaries)**
3. Build collectors for **5–10 Tier-1 bursary sources** (Part 6). Start narrow, done well.
4. Build the extraction + enrichment AI steps (Part 8) → populate real records.
5. Build the validation/publishing gate (Part 3, rule 2 & 7) and publish ~20–30 excellent bursary pages.
6. Build the **freshness loop** (Parts 4 & 7) — scheduled re-check, hash comparison, auto-close on expiry. *This is the part that makes it trustworthy and passive.*

**Phase 2 — Monetise + grow content**
7. Apply for AdSense (needs the quality pages + trust pages from Part 10). Add ad units tastefully.
8. Add affiliate/referral links helpfully (Part 2, Layer 2).
9. Expand bursary coverage; add category + province hub pages + internal linking (Part 10).

**Phase 3 — Second vertical + scale**
10. Flip on **learnerships** (system already supports it — a config + collectors change, not a rebuild). Add SETA collectors.
11. Add "submit an opportunity" form (Part 6, Tier 3).
12. Later: internships, entry-level jobs, and toward education-provider lead-gen (Part 2, Layer 3) + the CV toolkit (with POPIA, Part 11).

---

## PART 13 — Biggest risks & the workaround for each

| Risk | Why it hurts | Workaround |
|---|---|---|
| Google scaled-content penalty | Deindexed = no traffic = no income | Never publish thin. Quality gate before every page. Beat the source every time. |
| Stale closing dates / dead links | Trust dies instantly | The freshness loop (Part 7). Re-check on schedule; auto-close expired. |
| Overclaiming "verified" | Broken promise, worse than none | Say "continuously checked against the source" + last-confirmed date. |
| Sources blocking scrapers / PDFs | No data | Three-layer sourcing (Part 6): API→scraper→browser-agent fallback; OCR for PDFs. |
| Bursary seasonality | Traffic dips off-season | Build pages in low season to rank before the spike; stack learnerships (different cycle) for year-round traffic. |
| Competing with free SAYouth.mobi | It's free, zero-rated, gov-backed | Don't fight it on volume. Win on depth per opportunity — verified, clearer, better than anyone's listing. |
| Low SA/niche ad RPM | Small income at low volume | Stack revenue layers (Part 2); prioritise high-search-demand opportunities; grow volume with quality. |
| Solo founder capacity | The re-checking work can overwhelm | Automate the loop (layers 1–2). Keep manual browser-agent work for edge cases only. |

---

## PART 14 — The one question every page must answer

> *"What information would genuinely help someone decide whether to apply — and is it more accurate and clearer here than at the original source?"*

If a page doesn't clear that bar, it doesn't get published. That single rule is the whole company.
