import { db, pool, sourcesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { extractFacts } from "./pipeline/ai";
import { fetchSource } from "./pipeline/fetchSource";
import { linkWorks, normaliseHttpUrl } from "./pipeline/util";

async function main() {
  const sources = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.opportunityType, "learnership"))
    .orderBy(asc(sourcesTable.name));
  const results: unknown[] = [];

  for (const source of sources) {
    console.log(`\n=== ${source.name} (${source.organisation}) ===`);
    const fetched = await fetchSource(source);
    if (!fetched.ok) {
      results.push({
        sourceName: source.name,
        organisation: source.organisation,
        sourceUrl: source.url,
        fetched: false,
        fetchMethod: fetched.fetchMethod ?? "plain",
        httpStatus: fetched.httpStatus ?? null,
        reason: fetched.reason,
        extractedOpportunities: 0,
        usable: false,
      });
      console.log(`  fetch failed: ${fetched.reason}`);
      continue;
    }

    let extraction: Record<string, unknown>;
    try {
      extraction = await extractFacts({
        contentHash: fetched.contentHash,
        text: fetched.text,
        binary: fetched.binary,
        binaries: fetched.binaries,
      });
    } catch (error) {
      const reason = `extraction failed: ${(error as Error).message}`;
      results.push({
        sourceName: source.name,
        organisation: source.organisation,
        sourceUrl: source.url,
        resolvedUrl: fetched.resolvedUrl,
        fetched: true,
        fetchMethod: fetched.fetchMethod,
        httpStatus: fetched.httpStatus,
        reason,
        extractedOpportunities: 0,
        usable: false,
      });
      console.log(`  ${reason}`);
      continue;
    }

    const opportunities = Array.isArray(extraction.opportunities)
      ? (extraction.opportunities as Record<string, unknown>[])
      : [];
    const extracted = await Promise.all(
      opportunities.map(async (opportunity) => {
        const rawUrl =
          typeof opportunity.application_url === "string"
            ? opportunity.application_url
            : null;
        const applicationUrl = rawUrl ? normaliseHttpUrl(rawUrl) : null;
        return {
          title: opportunity.title ?? null,
          closingDate: opportunity.closing_date ?? null,
          closingDateRaw: opportunity.closing_date_raw ?? null,
          closingDateConfidence: opportunity.closing_date_confidence ?? null,
          isRolling: opportunity.is_rolling ?? false,
          applicationUrl,
          applicationLinkWorks: applicationUrl ? await linkWorks(applicationUrl) : false,
          organisation: opportunity.organisation ?? null,
          reviewFlags: opportunity.schema_misfit_flags ?? [],
        };
      }),
    );
    const usable = extracted.some(
      (opportunity) =>
        typeof opportunity.title === "string" &&
        opportunity.title.trim() &&
        (typeof opportunity.closingDate === "string" || opportunity.isRolling === true),
    );
    results.push({
      sourceName: source.name,
      organisation: source.organisation,
      sourceUrl: source.url,
      resolvedUrl: fetched.resolvedUrl,
      fetched: true,
      fetchMethod: fetched.fetchMethod,
      httpStatus: fetched.httpStatus,
      sourceNotes: extraction.source_notes ?? null,
      extractedOpportunities: extracted.length,
      opportunities: extracted,
      usable,
    });
    console.log(`  extracted ${extracted.length}; usable=${usable}`);
  }

  console.log(`[learnership-proof] ${JSON.stringify(results, null, 2)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());