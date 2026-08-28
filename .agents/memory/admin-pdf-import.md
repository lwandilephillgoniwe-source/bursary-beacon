---
name: Admin PDF imports
description: Rules for importing official bursary and learnership PDF adverts through the protected Admin workflow.
---

Uploaded PDFs use the same fact extraction, confidence scoring, duplicate detection, and fact/AI separation as web-source imports, but they always remain Drafts for manual review. A usable official webpage URL is required before publishing so public records have a verifiable source link.

**Why:** PDFs are useful official adverts, but unlike live webpages they cannot be rechecked by the normal freshness collector and may not carry enough provenance on their own.

**How to apply:** Keep PDF import behind Admin authentication, validate the file as a bounded PDF upload, preserve an audit snapshot, and require an official HTTP(S) source URL before approval.