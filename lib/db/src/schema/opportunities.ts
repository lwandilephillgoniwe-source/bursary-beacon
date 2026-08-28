import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The Opportunity record — one flexible record type for all verticals
 * (bursary | learnership | internship | job). See master brief Part 5.
 *
 * Extracted facts (from the official source) are stored separately from
 * AI-generated help (aiSummary / aiChecklist / aiFaq) so the page can render
 * them visually distinct and honestly labelled.
 */
export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  /** Permanent URL slug — lowercase, hyphens, no IDs. Never changed once published. */
  slug: text("slug").notNull().unique(),
  /** References opportunity_types.type (config-driven verticals) */
  type: text("type").notNull(),

  title: text("title").notNull(),
  organisation: text("organisation").notNull(),
  /** Province or "National" */
  province: text("province"),
  location: text("location"),
  fieldOfStudy: text("field_of_study"),
  industry: text("industry"),

  /** REQUIRED — the page we re-check against, forever. */
  officialSourceUrl: text("official_source_url").notNull(),
  officialApplicationUrl: text("official_application_url"),

  closingDate: date("closing_date", { mode: "string" }),
  /** high | medium | low — confidence that the source stated an exact date */
  closingDateConfidence: text("closing_date_confidence"),
  isRolling: boolean("is_rolling").notNull().default(false),
  opensDate: date("opens_date", { mode: "string" }),

  /** Structured eligibility facts, e.g. { citizenship, academic: [...], other: [...] } */
  eligibility: jsonb("eligibility").$type<Record<string, unknown>>(),
  /** Requirement lines pulled from the source */
  requirements: text("requirements").array(),
  requiredDocuments: text("required_documents").array(),

  /** Raw structured facts exactly as extracted from the source (facts, not AI prose) */
  extractedFacts: jsonb("extracted_facts").$type<Record<string, unknown>>(),
  /** Labelled AI help — kept separate from facts by design */
  aiSummary: text("ai_summary"),
  /** AI "Can I apply?" eligibility guidance — labelled AI help */
  aiEligibility: text("ai_eligibility"),
  aiChecklist: jsonb("ai_checklist").$type<string[]>(),
  aiFaq: jsonb("ai_faq").$type<{ q: string; a: string }[]>(),

  /** draft | published | closed | archived */
  status: text("status").notNull().default("draft"),

  /**
   * Transparent checklist confidence (Phase 1, per spec Task 4):
   * integer points awarded per check, with the full breakdown stored.
   * Missing/unparseable closing date forces band "low" regardless of points.
   */
  confidencePoints: integer("confidence_points"),
  /** low | medium | high — derived from the checklist, drives the publish gate */
  confidenceBand: text("confidence_band"),
  /** Per-check breakdown: [{ check, points, awarded, reason }] */
  confidenceBreakdown: jsonb("confidence_breakdown").$type<
    { check: string; points: number; awarded: boolean; reason: string }[]
  >(),

  /** Duplicate detection: normalised organisation+title+closing_date key */
  dedupeKey: text("dedupe_key"),
  /** Set when flagged as a near-duplicate of another record (admin resolves) */
  duplicateOfId: integer("duplicate_of_id"),
  duplicateFlagged: boolean("duplicate_flagged").notNull().default(false),

  /** Extraction problems for admin review, e.g. "source does not fit clean fields" */
  reviewFlags: text("review_flags").array(),
  /** Which collector/source produced this record */
  sourceName: text("source_name"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
  /** SHA-256 of the source page content, to detect changes on re-check */
  sourceContentHash: text("source_content_hash"),

  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  /** Optional pre-built JSON-LD override; when null the server derives it */
  schemaJson: jsonb("schema_json").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  /** Append-only status/state audit trail: [{ at, from, to, note }] */
  stateHistory: jsonb("state_history")
    .$type<{ at: string; from: string | null; to: string; note?: string }[]>()
    .notNull()
    .default([]),
});

export const OPPORTUNITY_STATUSES = [
  "draft",
  "published",
  "closed",
  "archived",
] as const;

export const CONFIDENCE_BANDS = ["low", "medium", "high"] as const;

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable, {
  status: z.enum(OPPORTUNITY_STATUSES),
  confidenceBand: z.enum(CONFIDENCE_BANDS).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
