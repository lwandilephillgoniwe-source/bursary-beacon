---
name: Legacy opportunity provenance
description: How backlog jobs should handle records created before source provenance was stored.
---

Older opportunity records may have no sourceName even when an equivalent official source exists in the registry. A backlog re-extraction must match these records by official URL host and organisation/title before deciding they are unresolved.

**Why:** Selecting only records with a sourceName silently skips part of the backlog and produces false before/after counts.

**How to apply:** For historical repair jobs, build the cohort first, resolve missing provenance against bursary-only registry rows, and verify that every selected record has exactly one outcome.