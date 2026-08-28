/**
 * Demo: deliberately trigger a silent-failure monitoring alert.
 *
 * Simulates a source that used to return records and now returns 0 —
 * the "source changed its HTML and coverage quietly rotted" scenario.
 *
 * How to run:
 *   pnpm --filter @workspace/scripts run test-alert
 *
 * What it does:
 *   1. Inserts fake historical run logs showing merseta-learnerships
 *      returned 3 records on each of the last 5 runs.
 *   2. Inserts a current run log showing 0 records (the "broken" state).
 *   3. Calls checkSilentFailures() — same function used by the real collector.
 *   4. A monitoring_alerts row is inserted and printed.
 *   5. The alert appears in /admin/monitoring immediately.
 *
 * After reviewing, acknowledge the alert from the admin panel or:
 *   UPDATE monitoring_alerts SET acknowledged = true WHERE source_name = 'merseta-learnerships';
 */
import { collectorRunLogsTable, db, monitoringAlertsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkSilentFailures } from "./pipeline/monitoring";

const SOURCE = "merseta-learnerships";

async function main() {
  console.log(`\n[test-alert] Simulating silent failure for source: ${SOURCE}\n`);

  // 1. Clear any previous test run-logs for this source so the test is repeatable
  // (real usage: never delete run logs — they are the audit trail)
  console.log("  Inserting fake historical run logs (3 records found × 5 runs)…");
  for (let i = 5; i >= 1; i--) {
    const ranAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000); // i days ago
    await db.insert(collectorRunLogsTable).values({
      sourceName: SOURCE,
      ranAt,
      recordsFound: 3,
      recordsUpserted: 1,
      durationMs: 4200,
    });
  }

  // 2. Insert the "broken" current run: fetched OK but returned 0 records
  console.log("  Inserting current (broken) run log: 0 records found…");
  await db.insert(collectorRunLogsTable).values({
    sourceName: SOURCE,
    recordsFound: 0,
    recordsUpserted: 0,
    durationMs: 3800,
  });

  // 3. Pre-acknowledge any existing alert so the detector fires fresh
  await db
    .update(monitoringAlertsTable)
    .set({ acknowledged: true })
    .where(eq(monitoringAlertsTable.sourceName, SOURCE));

  // 4. Run the detector — same logic used by the real collector
  console.log("  Running silent-failure detector…");
  const runResults = new Map([[SOURCE, { found: 0, upserted: 0 }]]);
  await checkSilentFailures(runResults);

  // 5. Print the alert that was created
  const alerts = await db
    .select()
    .from(monitoringAlertsTable)
    .where(eq(monitoringAlertsTable.sourceName, SOURCE));

  const latest = alerts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  if (latest) {
    console.log("\n✅  Alert created:");
    console.log(`   id:          ${latest.id}`);
    console.log(`   type:        ${latest.alertType}`);
    console.log(`   source:      ${latest.sourceName}`);
    console.log(`   message:     ${latest.message}`);
    console.log(`   acknowledged:${latest.acknowledged}`);
    console.log(`   created_at:  ${latest.createdAt}`);
    console.log("\n👉  View it at: http://localhost:8080/admin/monitoring  (or /admin/monitoring on prod)");
  } else {
    console.log("\n⚠️  No alert was created — check that the source has ≥2 historical runs.");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
