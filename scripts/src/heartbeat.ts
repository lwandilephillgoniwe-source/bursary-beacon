/**
 * Heartbeat job — the Phase 0 stand-in for the future re-check job.
 * Each run inserts one row into the heartbeats table. Intended to run as a
 * Scheduled Deployment (or locally: pnpm --filter @workspace/scripts run heartbeat).
 */
import { db, heartbeatsTable, pool } from "@workspace/db";
import { count } from "drizzle-orm";

async function main() {
  const [row] = await db
    .insert(heartbeatsTable)
    .values({ source: "script", note: "scheduled heartbeat run" })
    .returning();
  const [{ total }] = await db
    .select({ total: count() })
    .from(heartbeatsTable);
  console.log(
    `[heartbeat] recorded id=${row.id} at=${row.createdAt.toISOString()} — total heartbeats: ${total}`,
  );
}

main()
  .catch((err) => {
    console.error("[heartbeat] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
