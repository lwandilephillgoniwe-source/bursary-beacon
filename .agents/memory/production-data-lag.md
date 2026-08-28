---
name: Production data lag
description: Development data fixes and renderer safeguards do not affect the published database until the project is republished.
---

Production records can retain stale malformed URLs even after the development database and code are corrected. Public renderers should normalize official URLs defensively, while the corrected data still needs to go through the normal publish flow.

**Why:** A published NSFAS record stored a scheme-less application URL and remained broken in production after the development record was fixed.

**How to apply:** When auditing production, inspect both the live database and rendered HTML; treat a local fix as incomplete until a new publish updates the live build/data.