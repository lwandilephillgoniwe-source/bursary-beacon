/**
 * Silent-failure detection for the collector pipeline.
 *
 * A "silent failure" is when a source fetches OK (200, no error) but returns
 * ~0 records because the source changed its HTML structure — the danger case
 * where coverage quietly rots while everything looks green.
 *
 * Also checks for sources that have gone quiet (no run logged in N days).
 */
import {
  collectorRunLogsTable,
  db,
  monitoringAlertsTable,
  pool,
} from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL; // optional: POST alerts here

// How far back to look for historical baseline
const LOOKBACK_RUNS = 5;
// Minimum historical average to be considered "normally returns records"
const MIN_AVG_FOR_BASELINE = 0.5;
// How many days of silence before raising a source_quiet alert
const QUIET_DAYS = 7;

/** Post an alert to the optional webhook (email, Slack, WhatsApp relay, etc.) */
async function notifyWebhook(msg: string, details: Record<string, unknown>): Promise<void> {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: msg, details }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // webhook failure must never break the pipeline
  }
}

/**
 * After a collect run, compare each source's result against its history.
 * Inserts monitoring_alerts rows for sources that look broken.
 * Also checks sources that haven't run recently.
 *
 * @param results  Map<sourceName, {found, upserted, error}>
 */
export async function checkSilentFailures(
  results: Map<string, { found: number; upserted: number; error?: string }>,
): Promise<void> {
  // ── 1. Silent collector: ran fine but returned 0 records ─────────────────
  for (const [sourceName, { found, error }] of results) {
    if (error) {
      // Hard error already logged; only alert if no unacknowledged error alert exists
      const [existing] = await db
        .select({ id: monitoringAlertsTable.id })
        .from(monitoringAlertsTable)
        .where(
          and(
            eq(monitoringAlertsTable.sourceName, sourceName),
            eq(monitoringAlertsTable.alertType, "source_error"),
            eq(monitoringAlertsTable.acknowledged, false),
          ),
        )
        .limit(1);
      if (!existing) {
        const msg = `Source "${sourceName}" hard error this run: ${error}`;
        await db.insert(monitoringAlertsTable).values({
          alertType: "source_error",
          sourceName,
          message: msg,
          details: { error },
        });
        console.warn(`⚠️  ALERT source_error: ${sourceName}`);
        await notifyWebhook(msg, { sourceName, error });
      }
      continue;
    }

    if (found === 0) {
      // Look at recent historical runs (exclude current run — already logged)
      const prevRuns = await db
        .select({ recordsFound: collectorRunLogsTable.recordsFound, ranAt: collectorRunLogsTable.ranAt })
        .from(collectorRunLogsTable)
        .where(eq(collectorRunLogsTable.sourceName, sourceName))
        .orderBy(desc(collectorRunLogsTable.ranAt))
        .limit(LOOKBACK_RUNS + 1); // +1 because the current run was just inserted

      // Skip the most recent row (just inserted) for the baseline
      const history = prevRuns.slice(1);
      if (history.length < 2) continue; // not enough history to know

      const avg =
        history.reduce((s, r) => s + r.recordsFound, 0) / history.length;
      if (avg <= MIN_AVG_FOR_BASELINE) continue; // source never returned records before

      // Check for an existing unacknowledged alert
      const [existing] = await db
        .select({ id: monitoringAlertsTable.id })
        .from(monitoringAlertsTable)
        .where(
          and(
            eq(monitoringAlertsTable.sourceName, sourceName),
            eq(monitoringAlertsTable.alertType, "silent_collector"),
            eq(monitoringAlertsTable.acknowledged, false),
          ),
        )
        .limit(1);

      if (!existing) {
        const msg = `"${sourceName}" returned 0 records — normally returns ~${avg.toFixed(1)}. Possible HTML change or advert cycle.`;
        await db.insert(monitoringAlertsTable).values({
          alertType: "silent_collector",
          sourceName,
          message: msg,
          details: {
            currentFound: 0,
            historicalAverage: avg,
            recentRuns: history.map((r) => ({
              ranAt: r.ranAt,
              recordsFound: r.recordsFound,
            })),
          },
        });
        console.warn(`⚠️  ALERT silent_collector: ${sourceName} (avg ${avg.toFixed(1)} → 0)`);
        await notifyWebhook(msg, { sourceName, avg, history });
      }
    }
  }

  // ── 2. Source quiet: no run at all in QUIET_DAYS ─────────────────────────
  const cutoff = new Date(Date.now() - QUIET_DAYS * 24 * 60 * 60 * 1000);
  const quietSources = await db
    .select({ sourceName: collectorRunLogsTable.sourceName })
    .from(collectorRunLogsTable)
    .where(lt(collectorRunLogsTable.ranAt, cutoff))
    .groupBy(collectorRunLogsTable.sourceName);

  for (const { sourceName } of quietSources) {
    if (results.has(sourceName)) continue; // ran this cycle — fine
    const [existing] = await db
      .select({ id: monitoringAlertsTable.id })
      .from(monitoringAlertsTable)
      .where(
        and(
          eq(monitoringAlertsTable.sourceName, sourceName),
          eq(monitoringAlertsTable.alertType, "source_quiet"),
          eq(monitoringAlertsTable.acknowledged, false),
        ),
      )
      .limit(1);
    if (!existing) {
      const msg = `Source "${sourceName}" has not been run in over ${QUIET_DAYS} days.`;
      await db.insert(monitoringAlertsTable).values({
        alertType: "source_quiet",
        sourceName,
        message: msg,
        details: { quietSinceCutoff: cutoff.toISOString() },
      });
      console.warn(`⚠️  ALERT source_quiet: ${sourceName}`);
      await notifyWebhook(msg, { sourceName, cutoff: cutoff.toISOString() });
    }
  }
}

// ── Standalone: run check against the current DB state ───────────────────────
if (process.argv[1]?.endsWith("monitoring.ts") || process.argv[1]?.endsWith("monitoring.js")) {
  checkSilentFailures(new Map())
    .then(() => console.log("monitoring check done"))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
