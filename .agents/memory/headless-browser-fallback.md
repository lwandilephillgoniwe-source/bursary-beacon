---
name: Headless browser fallback
description: Browser retries are limited to robots-approved HTML sources after specific normal-fetch failures.
---

The collector keeps plain HTTP as the default and launches one Playwright Chromium attempt only after a robots-approved HTML source returns 403/408/429, times out, fails at the network layer, or produces JS-only/empty resolver content. HTTP 404 is not itself a browser trigger, and robots-disallowed sources must return before any browser launch.

**Why:** Official opportunity pages can be protected or JavaScript-rendered, but bypassing robots rules or broadly retrying every broken URL creates unsafe, noisy collection.

**How to apply:** Keep browser proof scoped to explicitly selected discovery-only sources until the rendered page is usable; record browser attempted/succeeded separately from resolver/date/extraction outcomes.