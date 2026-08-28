import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import { db, heartbeatsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

/**
 * Protected internal endpoints for external cron services and scheduled tasks.
 * All mutating routes require:  Authorization: Bearer <SESSION_SECRET>
 */
const heartbeatRouter: IRouter = Router();
let collectionInFlight = false;

// ── Auth helper ───────────────────────────────────────────────────────────────

function bearerAuthed(req: Parameters<typeof heartbeatRouter.post>[1] extends (req: infer R, ...rest: unknown[]) => unknown ? R : never): boolean {
  const token = (req as { get: (h: string) => string | undefined }).get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(process.env.SESSION_SECRET && token === process.env.SESSION_SECRET);
}

// ── POST /api/internal/heartbeat ─────────────────────────────────────────────
// Lightweight ping — records a heartbeat row and returns its id.
// Use this to verify the app is alive without triggering a full recheck.

heartbeatRouter.post("/internal/heartbeat", async (req, res, next) => {
  try {
    if (!bearerAuthed(req as never)) { res.status(401).json({ error: "unauthorized" }); return; }
    const [row] = await db
      .insert(heartbeatsTable)
      .values({ source: "endpoint", note: "external cron ping" })
      .returning();
    req.log.info({ heartbeatId: row.id }, "heartbeat recorded via endpoint");
    res.status(201).json({ ok: true, id: row.id, at: row.createdAt });
  } catch (err) { next(err); }
});

// ── POST /api/internal/recheck ────────────────────────────────────────────────
// Triggers the full freshness-loop script in the background.
// Returns 202 Accepted immediately; the script runs asynchronously.
//
// Safe to call from an external cron service (cron-job.org, GitHub Actions, etc.)
// by sending:  Authorization: Bearer <SESSION_SECRET>
//
// The same script that runs as a Scheduled Deployment also runs here, so either
// trigger path produces identical behaviour.

heartbeatRouter.post("/internal/recheck", async (req, res, next) => {
  try {
    if (!bearerAuthed(req as never)) { res.status(401).json({ error: "unauthorized" }); return; }

    // Spawn the recheck script as a detached background process so the HTTP
    // response returns immediately, even if recheck takes a minute or two.
    const child = spawn(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "recheck"],
      {
        cwd: process.cwd(),       // monorepo root in both dev and production
        stdio: "ignore",
        detached: true,
      },
    );
    child.unref(); // Allow the parent process to exit independently

    const [row] = await db
      .insert(heartbeatsTable)
      .values({ source: "endpoint", note: `recheck job spawned (pid ${child.pid ?? "unknown"})` })
      .returning();

    req.log.info({ heartbeatId: row.id, pid: child.pid }, "recheck spawned via endpoint");
    res.status(202).json({ accepted: true, heartbeatId: row.id, pid: child.pid });
  } catch (err) { next(err); }
});

// ── POST /api/internal/collect ────────────────────────────────────────────────
// Triggers the source collector in the background. The collector fetches every
// active official source in the registry, extracts opportunities, deduplicates
// them, and stores new/uncertain records for admin review.
heartbeatRouter.post("/internal/collect", async (req, res, next) => {
  try {
    if (!bearerAuthed(req as never)) { res.status(401).json({ error: "unauthorized" }); return; }
    if (collectionInFlight) {
      res.status(409).json({ accepted: false, error: "collection already running" });
      return;
    }

    collectionInFlight = true;
    const child = spawn(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "collect"],
      {
        cwd: process.cwd(),
        stdio: "ignore",
        detached: true,
      },
    );
    child.on("exit", () => { collectionInFlight = false; });
    child.on("error", () => { collectionInFlight = false; });
    child.unref();

    const [row] = await db
      .insert(heartbeatsTable)
      .values({ source: "endpoint", note: `collection job spawned (pid ${child.pid ?? "unknown"})` })
      .returning();

    req.log.info({ heartbeatId: row.id, pid: child.pid }, "collection spawned via endpoint");
    res.status(202).json({ accepted: true, heartbeatId: row.id, pid: child.pid });
  } catch (err) { next(err); }
});

// ── GET /api/internal/heartbeats ─────────────────────────────────────────────
// Read-only: recent heartbeats, to verify the job is running.

heartbeatRouter.get("/internal/heartbeats", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(heartbeatsTable)
      .orderBy(desc(heartbeatsTable.createdAt))
      .limit(20);
    res.json({ count: rows.length, rows });
  } catch (err) { next(err); }
});

export default heartbeatRouter;
