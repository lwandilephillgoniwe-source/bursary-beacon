---
name: Auto-publish safety
description: The permanent safety boundary for automated opportunity publishing.
---

Collection may auto-publish only a genuinely new opportunity when every gate passes: exact future closing date, verified official application URL returning HTTP 200, identified organisation, high confidence, no duplicate, and no review flags.

Existing records are never promoted by collection, including records that are re-extracted with improved facts. Records with no date, past dates, low/medium confidence, missing/unverified links, duplicates, or review flags remain in their existing state for manual review.

**Why:** The platform’s trust model requires that extraction improvements cannot silently publish the existing draft backlog or turn uncertain source content into public facts.

**How to apply:** Preserve this boundary whenever adding collector, recheck, extraction, or publishing behavior. Add an explicit audit row for every automated publish.