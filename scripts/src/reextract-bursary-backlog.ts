/**
 * Re-extract the existing bursary draft backlog with the current resolver,
 * vision-aware extractor, and strict publish gate.
 *
 * This intentionally does not create new opportunities. It only updates the
 * cohort selected at the start of the run:
 *   status = draft AND type = bursary AND (closing_date IS NULL OR confidence low)
 *
 * Run:
 *   pnpm --filter @workspace/scripts run reextract-bursary-backlog
 */
import {
  autoPublishAuditsTable,
  collectorRunLogsTable,
  db,
  opportunitiesTable,
  pool,
  sourcesTable,
  type Opportunity,
  type Source,
} from "@workspace/db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { enrich, extractFacts } from "./pipeline/ai";
import { fetchSource, type FetchResult } from "./pipeline/fetchSource";
import { scoreConfidence } from "./pipeline/score";
import {
  dedupeKeyOf,
  linkWorks,
  normaliseHttpUrl,
  sha256,
  slugify,
} from "./pipeline/util";

type ExtractedOpp = {
  title: string;
  organisation: string | null;
  province: string | null;
  field_of_study: string | null;
  closing_date: string | null;
  closing_date_raw: string | null;
  opens_date: string | null;
  is_rolling: boolean;
  application_url: string | null;
  eligibility: Record<string, unknown> | string | null;
  requirements: string[] | string | null;
  required_documents: string[] | string | null;
  coverage: string | null;
  conditions?: string[] | string | null;
  schema_misfit_flags: string[] | string | null;
  closing_date_confidence?: string | null;
};

type BacklogRow = Opportunity;

type RecordOutcome = {
  id: number;
  sourceName: string;
  title: string;
  beforeClosingDate: string | null;
  afterClosingDate: string | null;
  status: "published" | "draft";
  reason: string;
};

type Report = {
  startedAt: string;
  finishedAt: string;
  cohortSize: number;
  beforeNoDate: number;
  afterNoDate: number;
  afterParseableDate: number;
  autoPublished: number;
  stayedDraft: number;
  records: RecordOutcome[];
  unresolvedSources: { sourceName: string; url: string; reason: string }[];
};

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" && value.trim() ? [value] : [];
}

function eligibilityObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) return { other: value };
  return null;
}

function normaliseExtractedOpp(raw: ExtractedOpp): ExtractedOpp {
  return {
    ...raw,
    organisation: typeof raw.organisation === "string" ? raw.organisation : null,
    eligibility: eligibilityObject(raw.eligibility),
    requirements: stringArray(raw.requirements),
    required_documents: stringArray(raw.required_documents),
    conditions: stringArray(raw.conditions),
    schema_misfit_flags: stringArray(raw.schema_misfit_flags),
  };
}

function todayInJohannesburg(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function futureClosingDate(date: string | null): boolean {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > todayInJohannesburg();
}

function textKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hostOf(value: string | null | undefined): string {
  try {
    return new URL(value ?? "").hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function sourceScore(row: BacklogRow, source: Source): number {
  const rowHost = hostOf(row.officialSourceUrl);
  const sourceHost = hostOf(source.url);
  const rowText = textKey(`${row.title} ${row.organisation}`);
  const sourceText = textKey(`${source.name} ${source.organisation}`);
  let score = 0;
  if (rowHost && sourceHost && (rowHost === sourceHost || rowHost.endsWith(`.${sourceHost}`) || sourceHost.endsWith(`.${rowHost}`))) {
    score += 100;
  }
  const sourceTokens = sourceText.split(" ").filter((token) => token.length > 3);
  score += sourceTokens.filter((token) => rowText.includes(token)).length * 10;
  if (source.opportunityType === "bursary") score += 1;
  return score;
}

function resolveSourceForRow(row: BacklogRow, sources: Source[]): Source | null {
  const ranked = sources
    .map((source) => ({ source, score: sourceScore(row, source) }))
    .filter((candidate) => candidate.score > 1)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.source ?? null;
}

function addReason(flags: string[], reason: string): string[] {
  return flags.includes(reason) ? flags : [...flags, reason];
}

function historyEntry(from: string, to: string, note: string) {
  return { at: new Date().toISOString(), from, to, note };
}

function matchExtractedOpportunity(
  row: BacklogRow,
  extracted: ExtractedOpp[],
  source: Source,
): ExtractedOpp | null {
  const rowTitle = textKey(row.title);
  const rowOrg = textKey(row.organisation);
  const exactSlug = extracted.find((item) => {
    const organisation = item.organisation ?? source.organisation;
    const hasOrg = textKey(item.title).includes(textKey(organisation).split(" ")[0] ?? "");
    return slugify(hasOrg ? item.title : `${organisation} ${item.title}`) === row.slug;
  });
  if (exactSlug) return exactSlug;

  const titleMatch = extracted.find((item) => {
    const extractedTitle = textKey(item.title);
    const extractedOrg = textKey(item.organisation ?? source.organisation);
    return (
      extractedTitle === rowTitle ||
      (extractedTitle.length > 8 && (extractedTitle.includes(rowTitle) || rowTitle.includes(extractedTitle))) ||
      (extractedOrg === rowOrg && extractedTitle.split(" ").some((token) => token.length > 4 && rowTitle.includes(token)))
    );
  });
  if (titleMatch) return titleMatch;

  // A source with one target and one extracted advert is unambiguous even if
  // the title was reformatted by the new prompt.
  return extracted.length === 1 ? extracted[0] : null;
}

async function markUnresolved(
  row: BacklogRow,
  reason: string,
  outcomes: RecordOutcome[],
  resolvedSourceName?: string,
): Promise<void> {
  const flags = addReason(row.reviewFlags ?? [], `backlog re-extraction: ${reason}`);
  const history = [
    ...(row.stateHistory ?? []),
    historyEntry("draft", "draft", `backlog re-extraction: ${reason}`),
  ];
  await db
    .update(opportunitiesTable)
    .set({
      reviewFlags: flags,
      sourceName: resolvedSourceName ?? row.sourceName,
      stateHistory: history,
    })
    .where(eq(opportunitiesTable.id, row.id));
  outcomes.push({
    id: row.id,
    sourceName: row.sourceName ?? "unknown",
    title: row.title,
    beforeClosingDate: row.closingDate,
    afterClosingDate: row.closingDate,
    status: "draft",
    reason,
  });
}

async function processBacklogRecord(
  row: BacklogRow,
  source: Source,
  fetched: Extract<FetchResult, { ok: true }>,
  extraction: Record<string, unknown>,
  outcomes: RecordOutcome[],
): Promise<void> {
  const rawOpps = Array.isArray(extraction.opportunities)
    ? (extraction.opportunities as ExtractedOpp[])
    : [];
  const ex = matchExtractedOpportunity(row, rawOpps.map(normaliseExtractedOpp), source);
  const notes = typeof extraction.source_notes === "string" ? extraction.source_notes : null;

  if (!ex) {
    await markUnresolved(
      row,
      notes ?? "no matching current opportunity was found on the resolved source page",
      outcomes,
    );
    return;
  }

  const organisation = ex.organisation ?? source.organisation;
  const effectiveClosingDate = ex.closing_date ?? row.closingDate;
  const appUrl = ex.application_url ? normaliseHttpUrl(ex.application_url) : null;
  const appLinkOk = appUrl ? await linkWorks(appUrl) : false;
  const conf = scoreConfidence({
    closingDate: effectiveClosingDate,
    isRolling: ex.is_rolling ?? false,
    eligibility: eligibilityObject(ex.eligibility),
    applicationLinkWorks: appLinkOk,
    applicationUrl: appUrl,
    organisation,
  });

  const dedupeKey = dedupeKeyOf("bursary", organisation, ex.title, effectiveClosingDate);
  const duplicateRows = await db
    .select({
      id: opportunitiesTable.id,
      slug: opportunitiesTable.slug,
      organisation: opportunitiesTable.organisation,
    })
    .from(opportunitiesTable)
    .where(
      and(
        eq(opportunitiesTable.dedupeKey, dedupeKey),
        // The current draft is allowed to evaluate itself.
      ),
    );
  let duplicate = duplicateRows.find((candidate) => candidate.id !== row.id);
  if (!duplicate && effectiveClosingDate) {
    const sameDate = await db
      .select({
        id: opportunitiesTable.id,
        slug: opportunitiesTable.slug,
        organisation: opportunitiesTable.organisation,
      })
      .from(opportunitiesTable)
      .where(
        and(
          eq(opportunitiesTable.closingDate, effectiveClosingDate),
          eq(opportunitiesTable.type, "bursary"),
        ),
      );
    const orgKey = textKey(organisation);
    duplicate = sameDate.find((candidate) => {
      const candidateOrg = textKey(candidate.organisation);
      return candidate.id !== row.id && (candidateOrg.includes(orgKey) || orgKey.includes(candidateOrg));
    });
  }

  let ai: Record<string, unknown> = {};
  if (conf.band !== "low") {
    try {
      ai = await enrich(sha256(JSON.stringify(ex)), ex as unknown as Record<string, unknown>);
    } catch (error) {
      console.log(`  enrichment failed for ${row.slug}: ${(error as Error).message}`);
    }
  }

  let reviewFlags = stringArray(ex.schema_misfit_flags);
  if (ex.closing_date_raw && !ex.closing_date && !row.closingDate) {
    reviewFlags = addReason(
      reviewFlags,
      `closing date ambiguous in source: "${ex.closing_date_raw}"`,
    );
  }
  if (duplicate) {
    reviewFlags = addReason(reviewFlags, `possible duplicate of #${duplicate.id} (${duplicate.slug})`);
  }

  const reasons: string[] = [];
  if (!futureClosingDate(effectiveClosingDate)) reasons.push("closing date missing or not in the future");
  if (!appLinkOk) reasons.push("official application link did not return HTTP 200");
  if (!organisation.trim()) reasons.push("organisation not identified");
  if (conf.band !== "high") reasons.push(`confidence is ${conf.band}`);
  if (duplicate) reasons.push("duplicate detected");
  if (reviewFlags.length) reasons.push("review flags present");

  const passesGate =
    futureClosingDate(effectiveClosingDate) &&
    appLinkOk &&
    !!organisation.trim() &&
    conf.band === "high" &&
    !duplicate &&
    reviewFlags.length === 0;
  const status = passesGate ? "published" : "draft";
  const now = new Date();
  const history = [
    ...(row.stateHistory ?? []),
    historyEntry(
      "draft",
      status,
      passesGate
        ? `backlog re-extraction passed strict auto-publish gate: ${conf.points} pts (high)`
        : `backlog re-extraction stayed Draft: ${reasons.join("; ")}`,
    ),
  ];

  await db
    .update(opportunitiesTable)
    .set({
      officialSourceUrl: fetched.resolvedUrl,
      officialApplicationUrl: appUrl,
      closingDate: effectiveClosingDate,
      closingDateConfidence: ex.closing_date
        ? (ex.closing_date_confidence ?? "high")
        : row.closingDateConfidence,
      opensDate: ex.opens_date,
      isRolling: ex.is_rolling ?? false,
      organisation,
      province: ex.province,
      fieldOfStudy: ex.field_of_study,
      eligibility: eligibilityObject(ex.eligibility),
      requirements: stringArray(ex.requirements),
      requiredDocuments: stringArray(ex.required_documents),
      extractedFacts: {
        ...(row.extractedFacts ?? {}),
        coverage: ex.coverage,
        conditions: ex.conditions ?? null,
        closingDateRaw: ex.closing_date_raw,
        sourceNotes: notes,
      },
      aiSummary: (ai.ai_summary as string) ?? row.aiSummary,
      aiEligibility: (ai.ai_eligibility as string) ?? row.aiEligibility,
      aiChecklist: (ai.ai_checklist as string[]) ?? row.aiChecklist,
      aiFaq: (ai.ai_faq as { q: string; a: string }[]) ?? row.aiFaq,
      status,
      confidencePoints: conf.points,
      confidenceBand: conf.band,
      confidenceBreakdown: conf.breakdown,
      dedupeKey,
      duplicateFlagged: !!duplicate,
      duplicateOfId: duplicate?.id ?? null,
      reviewFlags,
      sourceName: source.name,
      sourceContentHash: fetched.contentHash,
      lastFetchedAt: now,
      lastConfirmedAt: now,
      stateHistory: history,
    })
    .where(eq(opportunitiesTable.id, row.id));

  if (passesGate) {
    await db.insert(autoPublishAuditsTable).values({
      opportunityId: row.id,
      title: row.title,
      closingDate: effectiveClosingDate!,
      confidenceBand: conf.band,
      sourceUrl: fetched.resolvedUrl,
    });
  }

  outcomes.push({
    id: row.id,
    sourceName: row.sourceName ?? source.name,
    title: row.title,
    beforeClosingDate: row.closingDate,
    afterClosingDate: effectiveClosingDate,
    status,
    reason: passesGate ? "strict auto-publish gate passed" : reasons.join("; "),
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  const backlog = await db
    .select()
    .from(opportunitiesTable)
    .where(
      and(
        eq(opportunitiesTable.type, "bursary"),
        eq(opportunitiesTable.status, "draft"),
        or(isNull(opportunitiesTable.closingDate), eq(opportunitiesTable.confidenceBand, "low")),
      ),
    );
  const beforeNoDate = backlog.filter((row) => !row.closingDate).length;
  const outcomes: RecordOutcome[] = [];
  const unresolvedSources: { sourceName: string; url: string; reason: string }[] = [];
  const sources = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.opportunityType, "bursary"));
  const resolvedRows = backlog.map((row) => ({
    row,
    source: row.sourceName
      ? sources.find((source) => source.name === row.sourceName) ?? null
      : resolveSourceForRow(row, sources),
  }));
  const sourceNames = [...new Set(
    resolvedRows
      .map(({ source }) => source?.name)
      .filter((name): name is string => !!name),
  )];

  for (const sourceName of sourceNames) {
    const source = sources.find((candidate) => candidate.name === sourceName) ?? null;
    const rows = resolvedRows
      .filter(({ source: resolvedSource }) => resolvedSource?.name === sourceName)
      .map(({ row }) => row);
    if (!source) {
      const reason = "source registry row not found";
      unresolvedSources.push({ sourceName, url: "", reason });
      for (const row of rows) await markUnresolved(row, reason, outcomes);
      continue;
    }

    console.log(`\n=== backlog: ${source.name} (${rows.length} record(s)) ===`);
    const fetched = await fetchSource(source);
    if (!fetched.ok) {
      unresolvedSources.push({ sourceName, url: source.url, reason: fetched.reason });
      for (const row of rows) await markUnresolved(row, fetched.reason, outcomes, source.name);
      await db.insert(collectorRunLogsTable).values({
        sourceName,
        recordsFound: 0,
        recordsUpserted: 0,
        error: `backlog re-extraction: ${fetched.reason}`,
      });
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
      unresolvedSources.push({ sourceName, url: fetched.resolvedUrl, reason });
      for (const row of rows) await markUnresolved(row, reason, outcomes, source.name);
      await db.insert(collectorRunLogsTable).values({
        sourceName,
        recordsFound: 0,
        recordsUpserted: 0,
        error: `backlog re-extraction: ${reason}`,
      });
      continue;
    }

    const rawOpps = Array.isArray(extraction.opportunities)
      ? extraction.opportunities
      : [];
    for (const row of rows) {
      await processBacklogRecord(row, source, fetched, extraction, outcomes);
    }
    await db.insert(collectorRunLogsTable).values({
      sourceName,
      recordsFound: rawOpps.length,
      recordsUpserted: rows.length,
      error: null,
    });
  }

  for (const { row, source } of resolvedRows.filter(({ source: resolvedSource }) => !resolvedSource)) {
    const reason = row.sourceName
      ? "source registry row not found"
      : "could not match legacy record to an official bursary source";
    unresolvedSources.push({ sourceName: row.sourceName ?? "(legacy record)", url: row.officialSourceUrl, reason });
    await markUnresolved(row, reason, outcomes);
  }

  const afterRows = await db
    .select({ id: opportunitiesTable.id, closingDate: opportunitiesTable.closingDate })
    .from(opportunitiesTable)
    .where(inArray(opportunitiesTable.id, backlog.map((row) => row.id)));
  const afterNoDate = afterRows.filter((row) => !row.closingDate).length;
  const report: Report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    cohortSize: backlog.length,
    beforeNoDate,
    afterNoDate,
    afterParseableDate: afterRows.filter((row) => !!row.closingDate).length,
    autoPublished: outcomes.filter((outcome) => outcome.status === "published").length,
    stayedDraft: outcomes.filter((outcome) => outcome.status === "draft").length,
    records: outcomes,
    unresolvedSources,
  };
  console.log(`\n[reextract-bursary-backlog] ${JSON.stringify(report, null, 2)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());