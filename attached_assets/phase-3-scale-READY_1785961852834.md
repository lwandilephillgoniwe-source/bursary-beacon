# PHASE 3 — SECOND VERTICAL + SCALE
### Paste this to Replit after Phase 2 is done and I've approved it.

Phase 2 is approved — the site earns and the content structure is in place. Now build
**Phase 3 only**: add the second vertical and the pieces that let the platform scale. Then
stop and show me.

## Goal of Phase 3
Prove the system was truly built for all verticals by flipping on **learnerships** with almost
no rebuild, add community submissions, and lay groundwork for the higher-value future
(education-provider leads + the CV toolkit). Same quality bar as everything before.

## Tasks

**1. Turn on learnerships (system already supports it).**
- Set `type = learnership` records live. The schema, template, gate, and freshness loop
  already handle this — this should be a **config + collectors change, not a rebuild**. If it
  isn't, that means Phase 0/1 wasn't built flexibly enough — flag it.
- Build collectors for **SETA websites** plus employer learnership pages. IMPORTANT: do NOT
  try to build all 21 SETAs. Government SETA sites are inconsistent, often PDF-driven, and
  redesign without warning — each is a fragile collector. Start with **3–5 high-volume ones**
  (e.g. MERSETA, SASSETA, Services SETA) and lean on **employer learnership pages**, which
  are more stable. Build the monitoring (Task 3) alongside these, not after — you'll need it.
- Learnerships have a different seasonal cycle than bursaries — together they give more
  year-round traffic.

**2. "Submit an opportunity" form — with abuse defences built in.**
A public submission form on a site with traffic WILL attract spam, SEO-link junk, and scam
"bursaries" that harvest students' details. Everything-to-Draft protects our published pages
but not my review time. So build the form with defences from day one:
- **Honeypot + CAPTCHA** to kill bots; **rate-limit per IP**.
- **Require an `official_source_url`** on every submission (no source = no submission). This
  blocks most junk AND feeds the freshness loop.
- Everything submitted goes to **Draft** and must pass the same extraction/verification/
  quality gate before publishing. **Never auto-publish submissions.**
- The review queue must allow **bulk-reject** of obvious junk — I will not review scam
  submissions one at a time.
- (If this becomes a time sink, we can quietly disable it — it's the lowest traffic-value,
  highest-maintenance item in this phase.)

**3. Scale + reliability housekeeping.**
- Make sure background jobs (collection + freshness loop) scale as records grow — batch and
  schedule sensibly, keep AI costs capped (only use expensive models for PDFs/verification;
  cache).
- Monitoring — and specifically catch **silent failure**, the real danger: a collector that
  runs "successfully" but returns ~0 records because the source changed its HTML, so coverage
  quietly rots while I think it's fine. Alert me (email/WhatsApp ping) when a collector that
  normally returns N records suddenly returns ~0, or when a source hasn't confirmed anything
  in X days. A simple alert beats a fancy dashboard.
- A helpful **404 page** that guides users to opportunities rather than dead-ending.

**4. Groundwork for the higher-value future (build, don't launch yet).**
- **Education-provider lead-gen:** structure course-interest signals so we can later connect
  students to colleges/universities that pay for qualified interest. POPIA CAUTION: model
  these as **aggregate/anonymous** signals now (e.g. "X clicks on engineering bursaries in
  Gauteng"). Do NOT store person-identifiable "this student wants this course" data yet — that
  repurposes personal data without consent and must sit behind the same POPIA gate as the CV
  toolkit. Prepare the data model only; don't build the sales side.
- **CV toolkit + POPIA:** when we add CV upload / matching, we must first implement: explicit
  consent before processing CVs/academic records, data minimisation, encryption at rest + in
  transit, secure auth, user data export + permanent deletion, disclosure of cross-border AI
  processing, audit logging, and a POPIA-compliant privacy policy. **Do not accept any
  personal CV data until these are in place.** For this phase, just plan the architecture —
  flag it as a gated future feature.

## Stop here
Show me: live learnership pages proving the system extended without a rebuild; the submission
form routing to Draft + gate (with the anti-abuse defences working); monitoring in place with
**proof that a deliberately broken collector actually triggers an alert**; and a short note on
the data groundwork for lead-gen + the CV/POPIA plan.

## What comes after Phase 3
Later verticals (internships, entry-level jobs), the education-provider revenue layer, and the
CV toolkit — each built with the same rules: beat the source, separate facts from AI, stay
Google-safe, and (for personal data) POPIA-first. We'll spec those as their own phases when we
get there.
