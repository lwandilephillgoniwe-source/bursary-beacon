import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  db,
  monitoringAlertsTable,
  collectorRunLogsTable,
  opportunitiesTable,
  sourcesTable,
  heartbeatsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * Founder admin panel.
 * Routes:
 *   GET  /admin/              — records dashboard (drafts, published, closed)
 *   GET  /admin/sources       — source registry + freshness heartbeats
 *   GET  /admin/monitoring    — monitoring alerts + collector run logs
 *   POST /admin/monitoring/:id/ack       — acknowledge an alert
 *   POST /admin/opportunities/:id/publish
 *   POST /admin/opportunities/:id/reject-duplicate
 *   POST /admin/opportunities/bulk-reject   — reject selected drafts (junk/spam)
 *
 * Access: HMAC-signed cookie (from /admin/login form) or x-admin-key header.
 * Never accepts key in query string — query strings leak into logs.
 */
const adminRouter: IRouter = Router();
const execFileAsync = promisify(execFile);
const MAX_ADMIN_PDF_BYTES = 12 * 1024 * 1024;

type MultipartPart = { name: string; filename?: string; contentType?: string; data: Buffer };

async function parseMultipart(req: Request, maxBytes: number): Promise<MultipartPart[]> {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = /^multipart\/form-data;\s*boundary="?([^";]+)"?/i.exec(contentType);
  if (!boundaryMatch) throw new Error("Expected a multipart/form-data upload.");
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > maxBytes + 1024 * 1024) throw new Error("The PDF is too large. Maximum size is 12 MB.");

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += data.length;
    if (total > maxBytes + 1024 * 1024) throw new Error("The PDF is too large. Maximum size is 12 MB.");
    chunks.push(data);
  }
  const body = Buffer.concat(chunks);
  const parts: MultipartPart[] = [];
  const delimiter = Buffer.concat([Buffer.from("\r\n"), boundary]);
  let cursor = body.indexOf(boundary);
  while (cursor >= 0) {
    const start = cursor + boundary.length;
    if (body.subarray(start, start + 2).toString() === "--") break;
    const partStart = body.subarray(start, start + 2).toString() === "\r\n" ? start + 2 : start;
    const headerEnd = body.indexOf("\r\n\r\n", partStart);
    if (headerEnd < 0) break;
    const nextBoundary = body.indexOf(delimiter, headerEnd + 4);
    if (nextBoundary < 0) break;
    const headers = body.subarray(partStart, headerEnd).toString("utf8");
    const dataEnd = nextBoundary;
    const disposition = /content-disposition:\s*form-data;([^]*?)(?:\r\n|$)/i.exec(headers)?.[1] ?? "";
    const name = /name="([^"]+)"/i.exec(disposition)?.[1];
    if (name) {
      const filename = /filename="([^"]*)"/i.exec(disposition)?.[1];
      const partType = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim();
      parts.push({ name, filename: filename || undefined, contentType: partType, data: body.subarray(headerEnd + 4, dataEnd) });
    }
    cursor = nextBoundary + 2;
  }
  return parts;
}

function multipartField(parts: MultipartPart[], name: string): string {
  return parts.find((part) => part.name === name && !part.filename)?.data.toString("utf8").trim() ?? "";
}

function importFailure(res: Response, title: string, message: string, status = 422): void {
  res.status(status).type("html").send(page(title, `
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    <p><a href="/admin">Back to Admin</a></p>`));
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`bb-admin:${exp}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function authed(req: Request): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const header = req.headers["x-admin-key"];
  if (typeof header === "string" && safeEqual(header, secret)) return true;
  const cookie = /(?:^|;\s*)bb_admin=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  if (!cookie) return false;
  const [expStr, mac] = cookie.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < Date.now()) return false;
  return safeEqual(mac, sign(exp, secret));
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authed(req)) {
    res.status(401).type("html").send(loginPage());
    return;
  }
  next();
}

function esc(s: unknown): string {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function loginPage(msg = ""): string {
  return page("Sign in", `
    <h1>Sign in</h1>
    ${msg ? `<p style="color:#b71c1c">${esc(msg)}</p>` : ""}
    <form method="post" action="/admin/login">
      <p><input type="password" name="key" placeholder="Admin key" style="padding:8px 12px;width:320px" autofocus></p>
      <p><button>Sign in</button></p>
    </form>`);
}

function page(title: string, body: string, alertCount = 0): string {
  const alertBadge = alertCount > 0
    ? ` <span style="background:#b71c1c;color:#fff;border-radius:999px;padding:1px 7px;font-size:.78rem;font-weight:700;vertical-align:middle">${alertCount}</span>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} | Bursary Beacon Admin</title>
<style>
 body{font-family:'DM Sans',system-ui,sans-serif;background:hsl(40,33%,98%);color:hsl(200,15%,15%);margin:0;line-height:1.55}
 header{background:hsl(186,69%,24%);color:#fff;padding:12px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
 header a{color:#fff;text-decoration:none;font-weight:600}
 main{max-width:1100px;margin:0 auto;padding:24px 20px 60px}
 table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;overflow:hidden;font-size:.92rem}
 th,td{text-align:left;padding:8px 12px;border-bottom:1px solid hsl(40,20%,92%);vertical-align:top}
 th{background:hsl(186,30%,94%)}
 .band-low{color:#b71c1c;font-weight:700}.band-medium{color:#b58a00;font-weight:700}.band-high{color:#1b7a2f;font-weight:700}
 .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:700}
 .pill.draft{background:#fff3cd}.pill.published{background:#d9f2df}.pill.closed{background:#fbe9e7}.pill.learnership{background:#e8eaf6}
 details{margin:4px 0}
 button{background:hsl(186,69%,24%);color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:600}
 button.warn{background:#8d3b2f}
 button.sm{padding:4px 8px;font-size:.82rem}
 .flag{background:#fff3cd;border-radius:6px;padding:2px 8px;font-size:.82rem;display:inline-block;margin:2px 2px}
 .flag.submission{background:#fce4ec}
 .alert-box{background:#fbe9e7;border:1px solid #e57373;border-radius:8px;padding:12px 16px;margin:8px 0}
 .alert-box strong{color:#b71c1c}
 h2{margin-top:36px}
 .bulk-bar{background:hsl(40,33%,94%);border-radius:8px;padding:10px 16px;margin:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 .import-box{background:#fff;border:2px solid hsl(186,69%,24%);border-radius:10px;padding:18px 20px;margin:18px 0 24px;max-width:760px}
 .import-box h2{margin-top:0;margin-bottom:8px}
 .import-box p{margin:6px 0;color:#444}
 .import-form{display:grid;grid-template-columns:1fr 180px auto;gap:10px;align-items:end;margin-top:14px}
 .import-form label{font-size:.8rem;font-weight:700;display:block}
 .import-form input,.import-form select{padding:8px 10px;border:1px solid #b8c3c5;border-radius:6px;font:inherit;width:100%}
 .import-form label:nth-of-type(2){grid-column:2;grid-row:1}
 .import-form select{grid-column:2;grid-row:2}
 .import-form input{grid-column:1;grid-row:2}
 .import-form button{grid-column:3;grid-row:2;white-space:nowrap}
 .pdf-form{display:grid;grid-template-columns:1fr 180px auto;gap:10px;align-items:end;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8e8}
 .pdf-form label{font-size:.8rem;font-weight:700;display:block}
 .pdf-form input,.pdf-form select{padding:8px 10px;border:1px solid #b8c3c5;border-radius:6px;font:inherit;width:100%;box-sizing:border-box}
 .pdf-form .pdf-file{grid-column:1;grid-row:2}
 .pdf-form .pdf-type{grid-column:2;grid-row:2}
 .pdf-form button{grid-column:3;grid-row:2;white-space:nowrap}
 .ok-box{background:#d9f2df;border:1px solid #66bb6a;border-radius:8px;padding:12px 16px;margin:10px 0;color:#1b5e20}
 @media(max-width:700px){.import-form,.pdf-form{display:flex;flex-direction:column;align-items:stretch}.import-form label:nth-of-type(2),.import-form select,.import-form input,.import-form button,.pdf-form input,.pdf-form select,.pdf-form button{grid-column:auto;grid-row:auto}}
</style></head><body>
<header>
  <strong>Bursary Beacon — Admin</strong>
  <a href="/">Public site</a>
  <a href="/directory">Page directory</a>
  <a href="/admin">Records</a>
  <a href="/admin/sources">Sources</a>
  <a href="/admin/monitoring">Monitoring${alertBadge}</a>
</header>
<main>${body}</main></body></html>`;
}

function breakdownHtml(opp: { confidencePoints: number | null; confidenceBand: string | null; confidenceBreakdown: { check: string; points: number; awarded: boolean; reason: string }[] | null }): string {
  if (!opp.confidenceBreakdown) return "—";
  const rows = opp.confidenceBreakdown
    .map((c) => `<li>${c.awarded ? "✅" : "❌"} <strong>${esc(c.check)}</strong> (${c.awarded ? `+${c.points}` : "0"}) — ${esc(c.reason)}</li>`)
    .join("");
  return `<details><summary><span class="band-${esc(opp.confidenceBand)}">${opp.confidencePoints ?? "?"} pts · ${esc(opp.confidenceBand)}</span></summary><ul>${rows}</ul></details>`;
}

// ── Auth routes (public) ─────────────────────────────────────────────────────

adminRouter.get("/login", (_req, res) => res.type("html").send(loginPage()));

adminRouter.post("/login", (req, res) => {
  const secret = process.env.SESSION_SECRET;
  const key = typeof req.body?.key === "string" ? req.body.key : "";
  if (!secret || !key || !safeEqual(key, secret)) {
    res.status(401).type("html").send(loginPage("Wrong key — try again."));
    return;
  }
  const exp = Date.now() + SESSION_TTL_MS;
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `bb_admin=${exp}.${sign(exp, secret)}; Path=/; HttpOnly; SameSite=Strict;${secure} Max-Age=${SESSION_TTL_MS / 1000}`,
  );
  res.redirect("/admin");
});

adminRouter.use(requireAuth);

// ── POST /admin/import-pdf — upload an official PDF and extract into Draft ────

adminRouter.post("/import-pdf", async (req, res) => {
  let tempDir: string | undefined;
  try {
    const parts = await parseMultipart(req, MAX_ADMIN_PDF_BYTES);
    const file = parts.find((part) => part.name === "pdf_file" && part.filename);
    const type = ["bursary", "learnership"].includes(multipartField(parts, "opportunity_type"))
      ? multipartField(parts, "opportunity_type")
      : "bursary";
    const officialUrl = multipartField(parts, "official_source_url").slice(0, 500);
    if (!officialUrl) {
      importFailure(res, "Official source URL required", "Add the official webpage URL where visitors can verify this PDF advert.");
      return;
    }
    if (!file) {
      importFailure(res, "PDF required", "Choose an official PDF advert before submitting.");
      return;
    }
    if (file.data.length > MAX_ADMIN_PDF_BYTES) {
      importFailure(res, "PDF too large", "The PDF must be 12 MB or smaller.");
      return;
    }
    const looksLikePdf = file.contentType?.toLowerCase() === "application/pdf"
      || file.filename?.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf || file.data.subarray(0, 5).toString() !== "%PDF-") {
      importFailure(res, "PDF required", "Only genuine PDF files can be uploaded.");
      return;
    }
    if (officialUrl) {
      let parsed: URL;
      try {
        parsed = new URL(officialUrl);
      } catch {
        importFailure(res, "Invalid source URL", "The official source URL must begin with http:// or https://.");
        return;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        importFailure(res, "Invalid source URL", "The official source URL must begin with http:// or https://.");
        return;
      }
    }

    tempDir = await mkdtemp(join(tmpdir(), "bursary-beacon-admin-pdf-"));
    const tempPath = join(tempDir, "upload.pdf");
    await writeFile(tempPath, file.data, { mode: 0o600 });
    const filename = (file.filename ?? "official-advert.pdf").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
    const { stdout, stderr } = await execFileAsync(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "admin-import", "--", "--pdf", tempPath, type, filename, officialUrl],
      {
        cwd: process.cwd(),
        timeout: 180_000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, COLLECT_IMPORT_ONLY: "1" },
      },
    );
    if (stderr.trim()) console.warn(`[admin-pdf-import] ${stderr.trim().slice(-2000)}`);
    console.info(`[admin-pdf-import] ${stdout.trim().slice(-4000)}`);
    const match = stdout.match(/\[admin-import\]\s+(\{[\s\S]*\})\s*$/);
    const result = match ? JSON.parse(match[1]) as { found?: number; error?: string | null; proof?: { stayedDraft?: { reason?: string }[] }[] } : null;
    if (!result || result.error || !result.found) {
      const reason = result?.error ?? "No current opportunity was found in the uploaded PDF.";
      importFailure(res, "Nothing extracted", `${reason} Nothing was published.`);
      return;
    }
    res.redirect("/admin?imported=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[admin-pdf-import] failed: ${message}`);
    importFailure(res, "PDF import failed", message.slice(0, 1000), 502);
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

// ── POST /admin/import — paste an official link and extract into Draft ────────

adminRouter.post("/import", async (req, res, next) => {
  try {
    const url = String(req.body?.official_source_url ?? "").trim().slice(0, 500);
    const type = ["bursary", "learnership", "internship", "job"].includes(req.body?.opportunity_type)
      ? String(req.body.opportunity_type)
      : "bursary";

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).type("html").send(page("Import failed", `
        <h1>Import failed</h1>
        <p>Please paste a complete official URL beginning with <code>https://</code>.</p>
        <p><a href="/admin">Back to Admin</a></p>`));
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res.status(400).type("html").send(page("Import failed", `
        <h1>Import failed</h1>
        <p>Only HTTP and HTTPS official links can be checked.</p>
        <p><a href="/admin">Back to Admin</a></p>`));
      return;
    }

    const { stdout, stderr } = await execFileAsync(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "admin-import", "--", url, type],
      {
        cwd: process.cwd(),
        timeout: 180_000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, COLLECT_IMPORT_ONLY: "1" },
      },
    );
    if (stderr.trim()) console.warn(`[admin-import] ${stderr.trim().slice(-2000)}`);
    console.info(`[admin-import] ${stdout.trim().slice(-4000)}`);

    const match = stdout.match(/\[admin-import\]\s+(\{[\s\S]*\})\s*$/);
    const result = match ? JSON.parse(match[1]) as {
      found?: number;
      error?: string | null;
      proof?: { stayedDraft?: { reason?: string }[] };
    } : null;
    if (!result || result.error || !result.found) {
      const reason = result?.error
        ?? result?.proof?.stayedDraft?.[0]?.reason
        ?? "No current opportunity was found on that page.";
      res.status(422).type("html").send(page("Nothing extracted", `
        <h1>Nothing extracted</h1>
        <p>The page was checked, but no current opportunity with usable facts was found. Nothing was published.</p>
        <p class="flag">${esc(reason)}</p>
        <p><a href="/admin">Back to Admin</a></p>`));
      return;
    }
    res.redirect("/admin?imported=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[admin-import] failed: ${message}`);
    res.status(502).type("html").send(page("Import failed", `
      <h1>Import failed</h1>
      <p>The official page could not be extracted. No opportunity was published.</p>
      <p class="flag">${esc(message.slice(0, 1000))}</p>
      <p><a href="/admin">Back to Admin</a></p>`));
  }
});

// ── GET /admin/ — records dashboard ─────────────────────────────────────────

adminRouter.get("/", async (req, res, next) => {
  try {
    const all = await db.select().from(opportunitiesTable).orderBy(desc(opportunitiesTable.updatedAt));
    const alertCount = (await db.select({ id: monitoringAlertsTable.id })
      .from(monitoringAlertsTable)
      .where(eq(monitoringAlertsTable.acknowledged, false))).length;

    // Separate user submissions from pipeline-collected drafts
    const allDrafts = all.filter((o) => o.status === "draft");
    const submissions = allDrafts.filter((o) => (o.reviewFlags ?? []).includes("user_submission"));
    const drafts = allDrafts.filter((o) => !(o.reviewFlags ?? []).includes("user_submission"));
    const published = all.filter((o) => o.status === "published");
    const closed = all.filter((o) => o.status === "closed");

    // Row renderer — used inside both the bulk form and the display table
    const oppTypeLabel = (o: (typeof all)[number]) =>
      o.type !== "bursary" ? `<span class="pill ${esc(o.type)}" style="margin-left:4px">${esc(o.type)}</span>` : "";

    const draftRow = (o: (typeof all)[number]) => `
      <tr>
        <td style="width:28px"><input type="checkbox" name="ids" value="${o.id}" form="bulk-reject-form"></td>
        <td>
          <strong>${esc(o.title)}</strong>${oppTypeLabel(o)}<br>
          <small>${esc(o.organisation)} ·
            <a href="/${esc(o.type === "bursary" ? "bursaries" : o.type + "s")}/${esc(o.slug)}?preview=1">view page</a>
          </small>
          ${o.duplicateFlagged ? `<br><span class="flag">possible duplicate${o.duplicateOfId ? ` of #${o.duplicateOfId}` : ""}</span>` : ""}
          ${(o.reviewFlags ?? []).map((f) => `<br><span class="flag ${f === "user_submission" ? "submission" : ""}">${esc(f)}</span>`).join("")}
        </td>
        <td>${esc(o.closingDate ?? (o.isRolling ? "rolling" : "—"))}</td>
        <td>${breakdownHtml(o)}</td>
        <td>${o.lastConfirmedAt ? new Date(o.lastConfirmedAt).toISOString().slice(0, 10) : "—"}</td>
        <td>
          <form method="post" action="/admin/opportunities/${o.id}/publish" style="display:inline">
            <button class="sm">Approve &amp; publish</button>
          </form>
          ${o.duplicateFlagged ? `<form method="post" action="/admin/opportunities/${o.id}/reject-duplicate" style="display:inline"><button class="warn sm">Reject (dupe)</button></form>` : ""}
        </td>
      </tr>`;

    const pubRow = (o: (typeof all)[number]) => `
      <tr>
        <td><strong>${esc(o.title)}</strong>${oppTypeLabel(o)}<br>
          <small>${esc(o.organisation)} · <a href="/${o.type === "bursary" ? "bursaries" : o.type + "s"}/${esc(o.slug)}">view page</a></small></td>
        <td>${esc(o.closingDate ?? (o.isRolling ? "rolling" : "—"))}</td>
        <td>${breakdownHtml(o)}</td>
        <td>${o.lastConfirmedAt ? new Date(o.lastConfirmedAt).toISOString().slice(0, 10) : "—"}</td>
        <td><span class="pill published">published</span></td>
      </tr>`;

    const draftTableCols = `<tr><th></th><th>Opportunity</th><th>Closes</th><th>Confidence</th><th>Last confirmed</th><th></th></tr>`;

    const importNotice = req.query.imported === "1"
      ? `<div class="ok-box"><strong>Source checked.</strong> Extracted information was saved as a Draft. Review it below before publishing.</div>`
      : "";
    const body = `
      <h1>Records</h1>
      ${importNotice}
      <section class="import-box">
        <h2>Add an official opportunity link</h2>
        <p>Paste the funder, employer, university, or government page. Bursary Beacon will fetch it, extract the relevant facts, check the application link, score confidence, and save the result as a <strong>Draft</strong>.</p>
        <p><strong>Nothing is published by this form.</strong> You decide whether to approve a Draft below.</p>
        <form method="post" action="/admin/import" class="import-form">
          <label for="admin-source-url">Official source URL</label>
          <label for="admin-opportunity-type">Type</label>
          <input id="admin-source-url" name="official_source_url" type="url" required maxlength="500" placeholder="https://official-organisation.co.za/opportunity" />
          <select id="admin-opportunity-type" name="opportunity_type">
            <option value="bursary">Bursary</option>
            <option value="learnership">Learnership</option>
            <option value="internship">Internship</option>
            <option value="job">Job</option>
          </select>
          <button type="submit">Extract into Draft</button>
        </form>
        <form method="post" action="/admin/import-pdf" enctype="multipart/form-data" class="pdf-form">
          <label for="admin-pdf-file">Official PDF advert</label>
          <label for="admin-pdf-type">Type</label>
          <input id="admin-pdf-file" class="pdf-file" name="pdf_file" type="file" accept="application/pdf,.pdf" required />
          <select id="admin-pdf-type" class="pdf-type" name="opportunity_type">
            <option value="bursary">Bursary</option>
            <option value="learnership">Learnership</option>
          </select>
          <button type="submit">Upload PDF into Draft</button>
          <label for="admin-pdf-source">Official webpage URL</label>
          <input id="admin-pdf-source" name="official_source_url" type="url" required maxlength="500" placeholder="https://official-organisation.co.za/advert" />
        </form>
        <p><small>PDFs must be 12 MB or smaller. Uploaded documents are checked with the same fact extraction and confidence rules, and are always saved as Drafts.</small></p>
      </section>
      <p>${allDrafts.length} draft(s) · ${published.length} published · ${closed.length} closed
         ${alertCount > 0 ? `· <a href="/admin/monitoring" style="color:#b71c1c;font-weight:700">⚠️ ${alertCount} unacknowledged monitoring alert(s)</a>` : ""}
      </p>

      ${submissions.length ? `
      <h2>Community submissions — waiting for review (${submissions.length})</h2>
      <p style="font-size:.88rem;color:#555">These were submitted via the public form. Check the official_source_url before approving. Confidence is typically low — the pipeline has not run on them.</p>
      <!-- Bulk-reject form anchored here; checkboxes anywhere on page use form="bulk-reject-form" -->
      <form id="bulk-reject-form" method="post" action="/admin/opportunities/bulk-reject"></form>
      <div class="bulk-bar">
        <button type="submit" form="bulk-reject-form" class="warn">Reject selected (spam/junk)</button>
        <span style="font-size:.85rem;color:#555">Check boxes on any row → click to archive in bulk. Use for obvious spam — you won't review them one by one.</span>
      </div>
      <table>${draftTableCols}${submissions.map(draftRow).join("")}</table>
      ` : ""}

      <h2>Pipeline drafts — waiting for review (${drafts.length})</h2>
      ${!submissions.length ? `
      <form id="bulk-reject-form" method="post" action="/admin/opportunities/bulk-reject"></form>
      <div class="bulk-bar">
        <button type="submit" form="bulk-reject-form" class="warn">Reject selected</button>
      </div>
      ` : ""}
      ${drafts.length ? `<table>${draftTableCols}${drafts.map(draftRow).join("")}</table>` : "<p>No pipeline drafts. ✅</p>"}

      <h2>Published (${published.length})</h2>
      <table><tr><th>Opportunity</th><th>Closes</th><th>Confidence</th><th>Last confirmed</th><th></th></tr>
      ${published.map(pubRow).join("")}</table>

      <h2>Closed (${closed.length})</h2>
      ${closed.length ? `<table><tr><th>Opportunity</th><th>Closed on</th><th>Confidence</th><th>Last confirmed</th><th></th></tr>
      ${closed.map((o) => `<tr><td><strong>${esc(o.title)}</strong>${oppTypeLabel(o)}<br><small>${esc(o.organisation)}</small></td>
        <td>${esc(o.closingDate ?? "—")}</td><td>${breakdownHtml(o)}</td>
        <td>${o.lastConfirmedAt ? new Date(o.lastConfirmedAt).toISOString().slice(0, 10) : "—"}</td>
        <td><span class="pill closed">closed</span></td></tr>`).join("")}</table>` : "<p>None yet.</p>"}
    `;
    res.type("html").send(page("Records", body, alertCount));
  } catch (err) { next(err); }
});

// ── GET /admin/sources ───────────────────────────────────────────────────────

adminRouter.get("/sources", async (_req, res, next) => {
  try {
    const sources = await db.select().from(sourcesTable).orderBy(sourcesTable.name);
    const beats = await db.select().from(heartbeatsTable).orderBy(desc(heartbeatsTable.createdAt)).limit(5);
    const alertCount = (await db.select({ id: monitoringAlertsTable.id })
      .from(monitoringAlertsTable)
      .where(eq(monitoringAlertsTable.acknowledged, false))).length;

    const body = `
      <h1>Source registry</h1>
      <table><tr><th>Source</th><th>Type</th><th>Kind</th><th>Active</th><th>Robots</th><th>Last fetch</th><th>Status</th></tr>
      ${sources.map((s) => `<tr>
        <td><strong>${esc(s.name)}</strong><br><small>${esc(s.organisation)} · <a href="${esc(s.url)}" rel="noopener">link</a></small></td>
        <td><span class="pill ${esc(s.opportunityType)}">${esc(s.opportunityType)}</span></td>
        <td>${esc(s.kind)}</td>
        <td>${s.active ? "yes" : "no"}</td>
        <td>${s.robotsAllowed === false ? "❌ blocked" : "✅"}</td>
        <td>${s.lastFetchedAt ? new Date(s.lastFetchedAt).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
        <td>${esc(s.lastFetchStatus ?? "—")}</td>
      </tr>`).join("")}</table>
      <h2>Recent freshness runs</h2>
      <ul>${beats.map((b) => `<li>${new Date(b.createdAt).toISOString().slice(0, 16).replace("T", " ")} — ${esc(b.note)}</li>`).join("") || "<li>None yet</li>"}</ul>
    `;
    res.type("html").send(page("Sources", body, alertCount));
  } catch (err) { next(err); }
});

// ── GET /admin/monitoring — alerts + run logs ────────────────────────────────

adminRouter.get("/monitoring", async (_req, res, next) => {
  try {
    const alerts = await db.select().from(monitoringAlertsTable)
      .orderBy(desc(monitoringAlertsTable.createdAt))
      .limit(50);
    const runs = await db.select().from(collectorRunLogsTable)
      .orderBy(desc(collectorRunLogsTable.ranAt))
      .limit(100);

    const unacked = alerts.filter((a) => !a.acknowledged);
    const acked = alerts.filter((a) => a.acknowledged);

    const alertRow = (a: (typeof alerts)[number]) => `
      <div class="alert-box" style="${a.acknowledged ? "opacity:.55;background:#f5f5f5;border-color:#ccc" : ""}">
        <strong>${esc(a.alertType)}</strong> — ${esc(a.sourceName)}<br>
        ${esc(a.message)}<br>
        <small style="color:#666">${new Date(a.createdAt).toISOString().slice(0, 16).replace("T"," ")} UTC
          ${a.acknowledged ? "· <em>acknowledged</em>" : ""}
        </small>
        ${!a.acknowledged ? `
          <form method="post" action="/admin/monitoring/${a.id}/ack" style="display:inline;margin-left:12px">
            <button class="sm">Acknowledge</button>
          </form>` : ""}
      </div>`;

    const body = `
      <h1>Monitoring</h1>
      ${unacked.length === 0
        ? `<p style="color:#1b7a2f;font-weight:700">✅ No unacknowledged alerts.</p>`
        : `<p style="color:#b71c1c;font-weight:700">⚠️ ${unacked.length} unacknowledged alert(s)</p>`}

      <h2>Active alerts</h2>
      ${unacked.length ? unacked.map(alertRow).join("") : "<p>None. ✅</p>"}

      <h2>Acknowledged alerts (last ${acked.length})</h2>
      ${acked.length ? acked.map(alertRow).join("") : "<p>None yet.</p>"}

      <h2>Collector run log (last ${runs.length} runs)</h2>
      <table>
        <tr><th>Source</th><th>Ran at</th><th>Records found</th><th>Upserted</th><th>Duration</th><th>Error</th></tr>
        ${runs.map((r) => `<tr style="${r.recordsFound === 0 && !r.error ? "background:#fff8e1" : ""}">
          <td>${esc(r.sourceName)}</td>
          <td>${new Date(r.ranAt).toISOString().slice(0, 16).replace("T", " ")}</td>
          <td style="${r.recordsFound === 0 ? "color:#b71c1c;font-weight:700" : ""}">${r.recordsFound}</td>
          <td>${r.recordsUpserted}</td>
          <td>${r.durationMs != null ? `${r.durationMs}ms` : "—"}</td>
          <td style="color:#b71c1c">${esc(r.error ?? "")}</td>
        </tr>`).join("")}
      </table>
      <p style="font-size:.84rem;color:#666">Rows highlighted in yellow: collector ran but returned 0 records (potential silent failure).</p>

      <h2>About monitoring alerts</h2>
      <div style="font-size:.9rem;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;max-width:640px">
        <p><strong>silent_collector</strong>: a source fetched successfully but returned ~0 records when it historically returns N. Usually means the source changed its HTML structure.</p>
        <p><strong>source_quiet</strong>: a source hasn't run in over 7 days.</p>
        <p><strong>source_error</strong>: the fetch or AI extraction raised a hard error this run.</p>
        <p>To receive alerts via email or WhatsApp, set the <code>ALERT_WEBHOOK_URL</code> environment variable to a POST endpoint (e.g. a Make.com or Zapier webhook that forwards to your email/WhatsApp).</p>
      </div>
    `;
    res.type("html").send(page("Monitoring", body, unacked.length));
  } catch (err) { next(err); }
});

// ── POST /admin/monitoring/:id/ack ───────────────────────────────────────────

adminRouter.post("/monitoring/:id/ack", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.update(monitoringAlertsTable)
      .set({ acknowledged: true })
      .where(eq(monitoringAlertsTable.id, id));
    res.redirect("/admin/monitoring");
  } catch (err) { next(err); }
});

// ── POST /admin/opportunities/bulk-reject ────────────────────────────────────

adminRouter.post("/opportunities/bulk-reject", async (req, res, next) => {
  try {
    const raw = req.body.ids;
    const ids = (Array.isArray(raw) ? raw : [raw])
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      res.redirect("/admin");
      return;
    }

    const now = new Date().toISOString();
    // Fetch all to build state history entries
    const opps = await db.select().from(opportunitiesTable).where(inArray(opportunitiesTable.id, ids));
    for (const opp of opps) {
      await db.update(opportunitiesTable).set({
        status: "archived",
        stateHistory: [
          ...(opp.stateHistory ?? []),
          { at: now, from: opp.status, to: "archived", note: "bulk-rejected by admin (junk/spam)" },
        ],
      }).where(eq(opportunitiesTable.id, opp.id));
    }
    res.redirect("/admin");
  } catch (err) { next(err); }
});

// ── POST /admin/opportunities/:id/publish ────────────────────────────────────

adminRouter.post("/opportunities/:id/publish", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    if (!opp) { res.status(404).send("not found"); return; }
    if (
      (opp.reviewFlags ?? []).includes("uploaded_pdf_manual_review") &&
      !/^https?:\/\//i.test(opp.officialSourceUrl)
    ) {
      res.status(403).type("html").send(page("Official source link required", `
        <h1>Official source link required</h1>
        <p><strong>${esc(opp.title)}</strong> came from an uploaded PDF, but it does not have a usable official webpage link.</p>
        <p>Import the PDF again with the official webpage URL so the published page can link visitors to the source.</p>
        <p><a href="/admin">Back to records</a></p>`));
      return;
    }
    if (opp.confidenceBand === "low" || opp.confidencePoints == null) {
      res.status(403).type("html").send(page("Cannot publish", `
        <h1>Cannot publish</h1>
        <p><strong>${esc(opp.title)}</strong> has a <span class="band-low">low</span> confidence score.
        The quality gate blocks this even for manual approval — the record needs better source facts first.</p>
        <p><a href="/admin">Back to records</a></p>`));
      return;
    }
    const overrides = [
      ...(opp.duplicateFlagged ? [`duplicate flag${opp.duplicateOfId ? ` (of #${opp.duplicateOfId})` : ""}`] : []),
      ...(opp.reviewFlags ?? []).filter((f) => f !== "user_submission" && f !== "demo_seed"),
    ];
    await db.update(opportunitiesTable).set({
      status: "published",
      duplicateFlagged: false,
      duplicateOfId: null,
      reviewFlags: [],
      stateHistory: [...(opp.stateHistory ?? []), {
        at: new Date().toISOString(),
        from: opp.status,
        to: "published",
        note: overrides.length
          ? `approved by admin, overriding: ${overrides.join("; ")}`
          : "approved by admin",
      }],
    }).where(eq(opportunitiesTable.id, id));
    res.redirect("/admin");
  } catch (err) { next(err); }
});

// ── POST /admin/opportunities/:id/reject-duplicate ───────────────────────────

adminRouter.post("/opportunities/:id/reject-duplicate", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    if (!opp) { res.status(404).send("not found"); return; }
    await db.update(opportunitiesTable).set({
      status: "archived",
      stateHistory: [...(opp.stateHistory ?? []), {
        at: new Date().toISOString(), from: opp.status, to: "archived",
        note: "rejected as duplicate by admin",
      }],
    }).where(eq(opportunitiesTable.id, id));
    res.redirect("/admin");
  } catch (err) { next(err); }
});

export default adminRouter;
export { authed as adminAuthed };
