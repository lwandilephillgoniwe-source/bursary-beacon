---
name: Outbound fetch safety
description: SSRF rules for any code that fetches source or AI-extracted URLs
---
Rule: every outbound fetch of a URL that originates from the source registry or AI extraction (including robots.txt lookups and link checks) must go through the shared SSRF-safe fetch helper in the pipeline utils, which validates http(s)-only + public host (DNS-resolved) on the initial URL AND every redirect hop (manual redirects). Never use `redirect: "follow"` on such URLs.

**Why:** completion review rejected the task twice for SSRF — first for no validation, then because pre-validating only the initial URL is bypassed by a redirect to localhost/private IPs.

**How to apply:** any new collector, link checker, or recheck code path that fetches remote content.
