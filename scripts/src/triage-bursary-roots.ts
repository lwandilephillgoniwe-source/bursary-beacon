import { db, pool, sourcesTable, type Source } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchSource } from "./pipeline/fetchSource";

const BLOCKED = /403|blocked-by-robots|blocked by robots/i;
const ROOT_RETRY = /404|unsafe|no bursary page|fetch-error|fetch error/i;

async function main() {
  const sources = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.opportunityType, "bursary"));
  const targets = sources.filter(
    (source) =>
      ROOT_RETRY.test(source.lastFetchStatus ?? "") &&
      !BLOCKED.test(source.lastFetchStatus ?? ""),
  );
  const results: unknown[] = [];

  for (const source of targets) {
    let root: string;
    try {
      root = `${new URL(source.url).origin}/`;
    } catch {
      results.push({
        name: source.name,
        organisation: source.organisation,
        oldUrl: source.url,
        result: "invalid source URL",
      });
      continue;
    }

    console.log(`[root-resolve] ${source.name} -> ${root}`);
    const result = await fetchSource({ ...source, url: root } as Source);
    results.push({
      name: source.name,
      organisation: source.organisation,
      oldUrl: source.url,
      root,
      ok: result.ok,
      reason: result.ok ? null : result.reason,
      resolvedUrl: result.ok ? result.resolvedUrl : null,
      resolvedFromHomepage: result.ok ? result.resolvedFromHomepage : null,
      httpStatus: result.ok ? result.httpStatus : result.httpStatus ?? null,
    });
  }

  console.log(`[triage-bursary-roots] ${JSON.stringify(results, null, 2)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());