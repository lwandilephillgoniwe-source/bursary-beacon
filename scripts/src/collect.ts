/**
 * Collector + pipeline runner (Phase 1–3):
 *   fetch each active Tier-1 source -> snapshot -> AI extract (cached) ->
 *   checklist confidence score -> duplicate detection -> AI enrich ->
 *   upsert as DRAFT -> publish gate -> monitoring.
 *
 * Vertical-aware: each source row carries opportunity_type (bursary |
 * learnership | …). Adding a new vertical is a sources-seed + opportunity_types
 * config row — no code rebuild required.
 *
 * Run: pnpm --filter @workspace/scripts run collect
 * Run one source: pnpm --filter @workspace/scripts run collect "source-name"
 */
import {
  autoPublishAuditsTable,
  collectorRunLogsTable,
  db,
  opportunitiesTable,
  pool,
  sourceSnapshotsTable,
  sourcesTable,
  type Opportunity,
} from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { enrich, extractFacts } from "./pipeline/ai";
import { fetchSource } from "./pipeline/fetchSource";
import { checkSilentFailures } from "./pipeline/monitoring";
import { scoreConfidence } from "./pipeline/score";
import { dedupeKeyOf, linkWorks, normaliseHttpUrl, sha256, slugify } from "./pipeline/util";

export type ExtractedOpp = {
  title: string;
  organisation: string | null;
  province: string | null;
  field_of_study: string | null;
  closing_date: string | null;
  closing_date_raw: string | null;
  opens_date: string | null;
  is_rolling: boolean;
  application_url: string | null;
  eligibility: Record<string, unknown> | null;
  requirements: string[] | null;
  required_documents: string[] | null;
  coverage: string | null;
  schema_misfit_flags: string[];
  closing_date_confidence?: string | null;
};

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value.trim() ? [value] : [];
}

function eligibilityObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
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
    schema_misfit_flags: stringArray(raw.schema_misfit_flags),
  };
}

function historyEntry(from: string | null, to: string, note: string) {
  return { at: new Date().toISOString(), from, to, note };
}

export type CollectionProof = {
  sourceName: string;
  originalUrl: string;
  resolvedUrl: string | null;
  fetchMethod: "plain" | "headless" | null;
  fetchSucceeded: boolean;
  closingDates: string[];
  autoPublished: { title: string; closingDate: string; reason: string }[];
  stayedDraft: { title: string; closingDate: string | null; reason: string }[];
};

export type ProcessSourceOptions = {
  /** Automated collection may publish only when the strict gate passes. */
  allowAutoPublish?: boolean;
  /** One-off admin PDF upload; bypasses network fetching but uses the same extraction pipeline. */
  uploadedBinary?: { data: Buffer; filename: string; sourceUrl: string };
};

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

/** Process one source and return run statistics plus proof details. */
export async function processSource(
  sourceName: string,
  options: ProcessSourceOptions = {},
): Promise<{ found: number; upserted: number; error?: string; proof: CollectionProof }> {
  const start = Date.now();
  const [source] = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.name, sourceName));
  const emptyProof: CollectionProof = {
    sourceName,
    originalUrl: source?.url ?? "",
    resolvedUrl: null,
    fetchMethod: null,
    fetchSucceeded: false,
    closingDates: [],
    autoPublished: [],
    stayedDraft: [],
  };
  if (!source || !source.active || source.discoveryOnly) {
    return { found: 0, upserted: 0, proof: emptyProof };
  }

  // The vertical is read from the source row — never hardcoded.
  const opportunityType = source.opportunityType ?? "bursary";
  console.log(`\n=== ${source.name} (${source.organisation}) [${opportunityType}] ===`);

  const fetched = options.uploadedBinary
    ? await (async () => {
      const contentHash = sha256(options.uploadedBinary!.data);
      const [snapshot] = await db.insert(sourceSnapshotsTable).values({
        url: options.uploadedBinary!.sourceUrl,
        sourceName: source.name,
        contentHash,
        contentType: "application/pdf",
        httpStatus: null,
        contentText: `[admin uploaded PDF ${options.uploadedBinary!.filename}, ${options.uploadedBinary!.data.length} bytes]`,
      }).returning({ id: sourceSnapshotsTable.id });
      await db.update(sourcesTable).set({ lastFetchStatus: "admin-uploaded-pdf", lastFetchedAt: new Date() }).where(eq(sourcesTable.id, source.id));
      return {
        ok: true as const,
        contentHash,
        text: undefined,
        binary: { data: options.uploadedBinary!.data, mimeType: "application/pdf", filename: options.uploadedBinary!.filename },
        binaries: undefined,
        httpStatus: 200,
        snapshotId: snapshot.id,
        originalUrl: options.uploadedBinary!.sourceUrl,
        resolvedUrl: options.uploadedBinary!.sourceUrl,
        resolvedFromHomepage: false,
        fetchMethod: "plain" as const,
      };
    })()
    : await fetchSource(source);
  if (!fetched.ok) {
    console.log(`  SKIP: ${fetched.reason}`);
    await db.insert(collectorRunLogsTable).values({
      sourceName,
      recordsFound: 0,
      recordsUpserted: 0,
      durationMs: Date.now() - start,
      error: fetched.reason,
    });
    return {
      found: 0,
      upserted: 0,
      error: fetched.reason,
      proof: {
        ...emptyProof,
        originalUrl: source.url,
        fetchMethod: fetched.fetchMethod ?? null,
        stayedDraft: [{ title: "(source not collected)", closingDate: null, reason: fetched.reason }],
      },
    };
  }
  console.log(`  fetched ok (hash ${fetched.contentHash.slice(0, 12)}…)`);

  let extraction: Record<string, unknown>;
  try {
    extraction = await extractFacts({
      contentHash: fetched.contentHash,
      text: fetched.text,
      binary: fetched.binary,
      binaries: fetched.binaries,
    });
  } catch (err) {
    const error = (err as Error).message;
    console.log(`  EXTRACTION FAILED: ${error}`);
    await db.insert(collectorRunLogsTable).values({
      sourceName,
      recordsFound: 0,
      recordsUpserted: 0,
      durationMs: Date.now() - start,
      error,
    });
    return {
      found: 0,
      upserted: 0,
      error,
      proof: { ...emptyProof, originalUrl: source.url, resolvedUrl: fetched.resolvedUrl },
    };
  }

  const opps = Array.isArray(extraction.opportunities)
    ? (extraction.opportunities as ExtractedOpp[]).map(normaliseExtractedOpp)
    : [];
  const notes = extraction.source_notes as string | null;
  console.log(`  extracted ${opps.length} opportunity(ies)${notes ? ` — notes: ${notes}` : ""}`);

  let upserted = 0;
  const proof: CollectionProof = {
    sourceName,
    originalUrl: fetched.originalUrl,
    resolvedUrl: fetched.resolvedUrl,
    fetchMethod: fetched.fetchMethod,
    fetchSucceeded: true,
    closingDates: [],
    autoPublished: [],
    stayedDraft: [],
  };
  if (!opps.length) {
    proof.stayedDraft.push({
      title: "(no current opportunity found)",
      closingDate: null,
      reason: notes ?? "The resolved page contained no extractable current opportunity.",
    });
  }
  for (const ex of opps) {
    if (!ex.title) continue;
    const organisation = ex.organisation ?? source.organisation;
    const titleHasOrg = ex.title.toLowerCase().includes(organisation.toLowerCase().split(" ")[0]);
    const slug = slugify(titleHasOrg ? ex.title : `${organisation} ${ex.title}`);
    const appUrl = ex.application_url ? normaliseHttpUrl(ex.application_url) : null;
    const appLinkOk = appUrl ? await linkWorks(appUrl) : false;

    const conf = scoreConfidence({
      closingDate: ex.closing_date,
      isRolling: ex.is_rolling ?? false,
      eligibility: ex.eligibility,
      applicationLinkWorks: appLinkOk,
      applicationUrl: appUrl,
      organisation,
    });

    // Duplicate detection: exact normalised key match (now type-namespaced to
    // prevent bursary/learnership cross-vertical collisions), plus near-match.
    const dedupeKey = dedupeKeyOf(opportunityType, organisation, ex.title, ex.closing_date);
    const [exact] = await db
      .select({ id: opportunitiesTable.id, slug: opportunitiesTable.slug, status: opportunitiesTable.status })
      .from(opportunitiesTable)
      .where(
        and(
          eq(opportunitiesTable.dedupeKey, dedupeKey),
          ne(opportunitiesTable.slug, slug),
        ),
      );
    let near: typeof exact | undefined = exact;
    if (!near && ex.closing_date) {
      const candidates = await db
        .select({
          id: opportunitiesTable.id,
          slug: opportunitiesTable.slug,
          status: opportunitiesTable.status,
          organisation: opportunitiesTable.organisation,
          type: opportunitiesTable.type,
        })
        .from(opportunitiesTable)
        .where(
          and(
            eq(opportunitiesTable.closingDate, ex.closing_date),
            eq(opportunitiesTable.type, opportunityType), // same vertical only
            ne(opportunitiesTable.slug, slug),
          ),
        );
      const orgNorm = organisation.toLowerCase().trim();
      near = candidates.find(
        (c) =>
          c.organisation.toLowerCase().trim().includes(orgNorm) ||
          orgNorm.includes(c.organisation.toLowerCase().trim()),
      );
    }
    const dupe = near;

    // Enrichment (only worth paying for when facts are usable)
    let ai: Record<string, unknown> = {};
    if (conf.band !== "low") {
      try {
        ai = await enrich(sha256(JSON.stringify(ex)), ex as unknown as Record<string, unknown>);
      } catch (err) {
        console.log(`  enrichment failed for ${slug}: ${(err as Error).message}`);
      }
    }

    const reviewFlags = [...(ex.schema_misfit_flags ?? [])];
    if (options.uploadedBinary) reviewFlags.push("uploaded_pdf_manual_review");
    if (ex.closing_date_raw && !ex.closing_date)
      reviewFlags.push(`closing date ambiguous in source: "${ex.closing_date_raw}"`);
    if (dupe) reviewFlags.push(`possible duplicate of #${dupe.id} (${dupe.slug})`);

    if (ex.closing_date) proof.closingDates.push(ex.closing_date);

    // Existing rows are deliberately never promoted by collection. This keeps
    // the existing Draft backlog out of auto-publish.
    const [existing] = await db
      .select()
      .from(opportunitiesTable)
      .where(eq(opportunitiesTable.slug, slug));
    const gateReasons: string[] = [];
    if (!futureClosingDate(ex.closing_date)) gateReasons.push("closing date missing or not in the future");
    if (!appLinkOk) gateReasons.push("official application link did not return HTTP 200");
    if (!organisation?.trim()) gateReasons.push("organisation not identified");
    if (conf.band !== "high") gateReasons.push(`confidence is ${conf.band}`);
    if (dupe) gateReasons.push("duplicate detected");
    if (reviewFlags.length) gateReasons.push("review flags present");
    if (existing) gateReasons.push("existing record; auto-publish excludes backlog");

    const passesGate =
      options.allowAutoPublish !== false &&
      !existing &&
      futureClosingDate(ex.closing_date) &&
      appLinkOk &&
      !!organisation?.trim() &&
      conf.band === "high" &&
      !dupe &&
      reviewFlags.length === 0;
    const status = passesGate ? "published" : "draft";
    const now = new Date();

    const values = {
      slug,
      type: opportunityType,   // ← from source.opportunityType, not hardcoded
      title: ex.title,
      organisation,
      province: ex.province,
      fieldOfStudy: ex.field_of_study,
      officialSourceUrl: fetched.resolvedUrl,
      officialApplicationUrl: appUrl,
      closingDate: ex.closing_date,
      closingDateConfidence: ex.closing_date
        ? (ex.closing_date_confidence ?? "high")
        : null,
      opensDate: ex.opens_date,
      isRolling: ex.is_rolling ?? false,
      eligibility: ex.eligibility,
      requirements: ex.requirements ?? [],
      requiredDocuments: ex.required_documents ?? [],
      extractedFacts: {
        coverage: ex.coverage,
        conditions: (ex as ExtractedOpp & { conditions?: unknown }).conditions ?? null,
        closingDateRaw: ex.closing_date_raw,
        sourceNotes: notes,
      },
      aiSummary: (ai.ai_summary as string) ?? null,
      aiEligibility: (ai.ai_eligibility as string) ?? null,
      aiChecklist: (ai.ai_checklist as string[]) ?? null,
      aiFaq: (ai.ai_faq as { q: string; a: string }[]) ?? null,
      status,
      confidencePoints: conf.points,
      confidenceBand: conf.band,
      confidenceBreakdown: conf.breakdown,
      dedupeKey,
      duplicateFlagged: !!dupe,
      duplicateOfId: dupe?.id ?? null,
      reviewFlags,
      sourceName: source.name,
      sourceContentHash: fetched.contentHash,
      lastFetchedAt: now,
      lastConfirmedAt: now,
      seoTitle: `${ex.title} — Closing Date, Who Qualifies & How to Apply`,
      metaDescription: null,
    };

    // Upsert by slug; preserve state history
    if (existing) {
      const history = [...(existing.stateHistory ?? [])];
      // Preserve the existing state. In particular, a manually reviewed
      // published/draft record must not be changed by the auto-publish gate.
      history.push(historyEntry(
        existing.status,
        existing.status,
        `pipeline re-run; auto-publish skipped: ${gateReasons.join(", ")}`,
      ));
      proof.stayedDraft.push({
        title: ex.title,
        closingDate: ex.closing_date,
        reason: gateReasons.join("; "),
      });
      await db
        .update(opportunitiesTable)
        .set({ ...values, status: existing.status, stateHistory: history })
        .where(eq(opportunitiesTable.id, existing.id));
    } else {
      const [inserted] = await db.insert(opportunitiesTable).values({
        ...values,
        stateHistory: [
          historyEntry(null, "draft", `collected from ${source.name}`),
          ...(status === "published"
            ? [historyEntry("draft", "published", `passed gate: ${conf.points} pts (${conf.band})`)]
            : [historyEntry("draft", "draft", options.allowAutoPublish === false
              ? `admin import; awaiting manual review: ${gateReasons.join("; ") || "automatic publishing disabled"}`
              : `collection stayed Draft: ${gateReasons.join("; ")}`)]),
        ],
      }).returning({ id: opportunitiesTable.id });
      if (passesGate && inserted) {
        await db.insert(autoPublishAuditsTable).values({
          opportunityId: inserted.id,
          title: ex.title,
          closingDate: ex.closing_date!,
          confidenceBand: conf.band,
          sourceUrl: fetched.resolvedUrl,
        });
        proof.autoPublished.push({
          title: ex.title,
          closingDate: ex.closing_date!,
          reason: "all strict auto-publish checks passed",
        });
      } else {
        proof.stayedDraft.push({
          title: ex.title,
          closingDate: ex.closing_date,
          reason: gateReasons.join("; "),
        });
      }
    }
    upserted++;

    console.log(
      `  -> ${slug}: ${conf.points} pts (${conf.band})${dupe ? " DUPLICATE-FLAGGED" : ""}${reviewFlags.length ? ` flags=[${reviewFlags.join("; ")}]` : ""} => ${status.toUpperCase()}`,
    );
  }

  const durationMs = Date.now() - start;
  await db.insert(collectorRunLogsTable).values({
    sourceName,
    recordsFound: opps.length,
    recordsUpserted: upserted,
    durationMs,
  });

  return { found: opps.length, upserted, proof };
}

async function main() {
  const only = process.argv[2]; // optional: run a single source by name
  const sources = await db
    .select()
    .from(sourcesTable)
    .where(and(eq(sourcesTable.active, true), eq(sourcesTable.discoveryOnly, false)));
  const runResults = new Map<string, { found: number; upserted: number; error?: string; proof: CollectionProof }>();

  for (const s of sources) {
    if (only && s.name !== only) continue;
    const result = await processSource(s.name);
    runResults.set(s.name, result);
    if (only) {
      console.log(`[proof] ${JSON.stringify(result.proof)}`);
    }
  }

  const all = await db
    .select({ status: opportunitiesTable.status })
    .from(opportunitiesTable);
  const counts: Record<string, number> = {};
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log(`\n[collect] done. Opportunity counts by status:`, counts);

  // Silent-failure detection — must run after current logs are written
  if (!only) {
    console.log("\n[collect] checking for silent failures…");
    await checkSilentFailures(runResults);
  }
}

if (process.env.COLLECT_IMPORT_ONLY !== "1") {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
