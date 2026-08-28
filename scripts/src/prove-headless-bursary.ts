import { db, pool, sourcesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const TARGETS = [
  "standard-bank-bursary",
  "sanlam-bursary",
  "anglo-american-bursaries",
  "pwc-bursary",
  "university-of-pretoria-bursaries",
];

async function main() {
  process.env.COLLECT_IMPORT_ONLY = "1";
  const { processSource } = await import("./collect");
  const sources = await db
    .select()
    .from(sourcesTable)
    .where(inArray(sourcesTable.name, TARGETS));
  const sourceMap = new Map(sources.map((source) => [source.name, source]));
  const results: unknown[] = [];

  for (const name of TARGETS) {
    const source = sourceMap.get(name);
    if (!source) {
      results.push({ sourceName: name, outcome: "source not found" });
      continue;
    }

    // Proof-only promotion: the normal collector still skips discovery-only
    // rows. The final state is decided from the browser-backed result below.
    await db
      .update(sourcesTable)
      .set({ discoveryOnly: false })
      .where(eq(sourcesTable.name, name));

    const result = await processSource(name);
    const browserAttempted = result.proof.fetchMethod === "headless";
    const browserSucceeded = browserAttempted && result.proof.fetchSucceeded;
    const collectible = browserSucceeded && !result.error && result.found > 0;
    const baseNotes = (source.notes ?? "")
      .replace(/\s*Headless proof recovered automated collection\./g, "")
      .replace(/\s*Discovery-only: headless fallback did not recover a collectible page\./g, "")
      .trim();

    await db
      .update(sourcesTable)
      .set({
        discoveryOnly: !collectible,
        notes: collectible
          ? `${baseNotes} Headless proof recovered automated collection.`.trim()
          : `${baseNotes} Discovery-only: headless fallback did not recover a collectible page.`.trim(),
      })
      .where(eq(sourcesTable.name, name));

    results.push({
      sourceName: name,
      headlessFetchAttempted: browserAttempted,
      headlessFetchBypassedBlock: browserSucceeded,
      fetchMethod: result.proof.fetchMethod,
      resolverUrl: result.proof.resolvedUrl,
      resolverFoundBursaryPage: !!result.proof.resolvedUrl,
      closingDates: result.proof.closingDates,
      closingDateExtracted: result.proof.closingDates.length > 0,
      movedToCollectible: collectible,
      stayedDiscoveryOnly: !collectible,
      error: result.error ?? null,
      stayedDraft: result.proof.stayedDraft,
    });
  }

  console.log(`[headless-bursary-proof] ${JSON.stringify(results, null, 2)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());