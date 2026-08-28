---
name: Discovery-only sources
description: Registry behavior for official sources that cannot be safely automated.
---

Blocked or unresolved bursary sources remain active in the source registry with discovery-only enabled. Automated collection filters them out; the registry notes preserve the access or resolution reason for manual follow-up.

**Why:** Deactivating these sources loses their discovery value, while repeatedly scraping blocked or dead URLs creates noisy failures and encourages unsafe bypasses.

**How to apply:** Use discovery-only for robots/403 blocks and for dead URLs whose official root does not yield a valid bursary page. Keep reachable pages with no current advert active and collectible.