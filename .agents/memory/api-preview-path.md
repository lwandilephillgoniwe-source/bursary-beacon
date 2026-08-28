---
name: API preview path
description: API server pages must be mirrored under /api for Replit preview testing.
---

# API preview path

The API artifact's preview path is `/api`, while the public deployment serves its server-rendered pages at root paths such as `/directory`, `/bursaries`, and `/submit`. For preview testing, the API server must mount the pages router under both `/api` and `/`.

**Why:** The Replit preview resolves an API artifact's relative page path under `/api`. Without the mirror, a correct root route can appear to be a false 404 in the preview.

**How to apply:** When adding a server-rendered page to the API artifact, add its root route to the artifact paths and keep `app.use("/api", pagesRouter)` alongside `app.use("/", pagesRouter)`.