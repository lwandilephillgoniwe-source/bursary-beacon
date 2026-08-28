# Memory index

- [Drizzle schema changes](drizzle-schema-changes.md) — push hits interactive rename prompts; drop/rename via SQL first, and keep the checked-in migration idempotent so it upgrades push-created DBs.
- [AI extraction cache](ai-extraction-cache.md) — extraction results are cached by contentHash+promptVersion; any prompt behavior change needs a NEW versioned prompt file or stale outputs persist.
- [Outbound fetch safety](outbound-fetch-safety.md) — all fetches of registry/AI-derived URLs must go through the per-hop SSRF-safe fetch helper; never `redirect: "follow"`.
- [Verticals must be DB-enabled](verticals-db-enabled.md) — opportunity_types.enabled=false blocks the route; enable each vertical in DB when activating it (not just via migration INSERT).
- [API preview path](api-preview-path.md) — API server pages need a /api mirror in app.ts because the Replit preview prefixes API artifact routes with /api.
- [Auto-publish safety](auto-publish-safety.md) — collection may auto-publish only genuinely new, high-confidence records with a future date and verified HTTP 200 application link.
- [Legacy opportunity provenance](legacy-opportunity-provenance.md) — older records may lack sourceName; backlog jobs must match them by official URL/organisation before re-extraction.
- [Discovery-only sources](discovery-only-sources.md) — blocked or unresolved bursary sources stay active for manual discovery but are skipped by automated collection.
- [Headless browser fallback](headless-browser-fallback.md) — Playwright is a robots-aware, failure-triggered fallback; 404s and robots-disallowed sources never launch it.
- [Production data lag](production-data-lag.md) — development fixes do not update published records until republish; renderers should still normalize official URLs defensively.
- [Learnership source quality](learnership-source-quality.md) — generic SETA guidance and filled vacancies stay discovery-only; only specific current intakes enter collection.
- [Admin PDF imports](admin-pdf-import.md) — uploaded bursary and learnership PDFs stay Draft-only and need an official webpage URL before publishing.
