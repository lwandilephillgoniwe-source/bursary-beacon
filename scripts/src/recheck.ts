/**
 * THE FRESHNESS LOOP (spec Task 5) — the scheduled re-check job.
 * Intended to run as a Scheduled Deployment (daily). For each PUBLISHED record:
 *
 *  1. Cadence: re-check weekly normally, daily in the final week before closing.
 *     (--force re-checks everything regardless of cadence.)
 *  2. Closing date passed -> status becomes "closed" (page stays up with a
 *     clear Closed banner; never deleted).
 *  3. Source removed (HTTP 404/410) -> "closed".
 *  4. Source content hash changed -> back to "draft" for re-validation
 *     (page temporarily unpublished rather than possibly wrong).
 *  5. Source unchanged and live -> update last_confirmed_at.
 *
 * Every transition is appended to state_history. Also records a heartbeat row.
 * Run: pnpm --filter @workspace/scripts run recheck [--force]
 */
import { db, heartbeatsTable, opportunitiesTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchUrlForRecheck } from "./pipeline/fetchSource";

const DAY = 24 * 60 * 60 * 1000;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueForRecheck(opp: {
  lastConfirmedAt: Date | null;
  closingDate: string | null;
}): boolean {
  if (!opp.lastConfirmedAt) return true;
  const age = Date.now() - opp.lastConfirmedAt.getTime();
  const nearClose =
    opp.closingDate &&
    new Date(opp.closingDate).getTime() - Date.now() < 7 * DAY;
  return nearClose ? age > 1 * DAY : age > 7 * DAY; // daily in final week, else weekly
}

async function transition(
  oppId: number,
  from: string,
  to: string,
  note: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const [opp] = await db
    .select({ stateHistory: opportunitiesTable.stateHistory })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, oppId));
  await db
    .update(opportunitiesTable)
    .set({
      status: to,
      stateHistory: [
        ...(opp?.stateHistory ?? []),
        { at: new Date().toISOString(), from, to, note },
      ],
      ...extra,
    })
    .where(eq(opportunitiesTable.id, oppId));
}

async function main() {
  const force = process.argv.includes("--force");
  const published = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.status, "published"));

  console.log(`[recheck] ${published.length} published record(s); force=${force}`);
  let checked = 0, closed = 0, redrafted = 0, confirmed = 0;

  for (const opp of published) {
    if (!force && !dueForRecheck(opp)) {
      console.log(`  ${opp.slug}: not due yet (cadence) — skipping`);
      continue;
    }
    checked++;

    // 1) Deadline passed? Close regardless of what the source says.
    if (opp.closingDate && !opp.isRolling && opp.closingDate < todayISO()) {
      await transition(
        opp.id,
        "published",
        "closed",
        `closing date ${opp.closingDate} has passed (auto-closed by freshness loop)`,
      );
      console.log(`  ${opp.slug}: CLOSED (deadline ${opp.closingDate} passed)`);
      closed++;
      continue;
    }

    // 2) Re-fetch the official source.
    const result = await fetchUrlForRecheck(opp.officialSourceUrl);
    if (!result.ok) {
      if (result.gone) {
        await transition(
          opp.id,
          "published",
          "closed",
          `official source removed (${result.reason}) — auto-closed by freshness loop`,
        );
        console.log(`  ${opp.slug}: CLOSED (source gone: ${result.reason})`);
        closed++;
      } else {
        console.log(`  ${opp.slug}: source unreachable (${result.reason}) — left as-is, will retry`);
      }
      continue;
    }

    // 3) Content changed? Back to draft for re-validation.
    if (opp.sourceContentHash && result.contentHash !== opp.sourceContentHash) {
      await transition(
        opp.id,
        "published",
        "draft",
        "source content changed (hash mismatch) — returned to draft for re-validation",
        { lastFetchedAt: new Date() },
      );
      console.log(`  ${opp.slug}: RE-DRAFTED (source changed)`);
      redrafted++;
      continue;
    }

    // 4) Still live and unchanged — confirm.
    await db
      .update(opportunitiesTable)
      .set({ lastConfirmedAt: new Date(), lastFetchedAt: new Date() })
      .where(eq(opportunitiesTable.id, opp.id));
    console.log(`  ${opp.slug}: confirmed still live`);
    confirmed++;
  }

  await db.insert(heartbeatsTable).values({
    source: "script",
    note: `recheck run: ${checked} checked, ${confirmed} confirmed, ${closed} closed, ${redrafted} re-drafted`,
  });
  console.log(
    `[recheck] done: ${checked} checked, ${confirmed} confirmed, ${closed} closed, ${redrafted} re-drafted`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
