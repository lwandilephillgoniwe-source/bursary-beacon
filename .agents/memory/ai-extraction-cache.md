---
name: AI extraction cache
description: Prompt versioning rule for the pipeline's cached AI calls
---
Rule: AI extraction/enrichment results are cached in the DB keyed by (content hash, prompt version). Changing prompt behavior requires creating a NEW versioned prompt file (e.g. extract-v3.md) and bumping the version constant — editing an existing prompt file silently does nothing for already-cached content.

**Why:** extract-v1 over-flagged normal conditions as review flags; the fix only took effect after introducing extract-v2 as a new version, because v1 results stayed cached.

**How to apply:** whenever adjusting extraction/enrichment prompts in `scripts/prompts/`.
