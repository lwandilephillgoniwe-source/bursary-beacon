import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Tier-1 source registry — the collectors' config. One row per official
 * source page (corporate bursary page, NSFAS, university financial aid, PDF).
 */
export const sourcesTable = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  organisation: text("organisation").notNull(),
  url: text("url").notNull(),
  /** html | pdf | image — drives fetch + extraction strategy */
  kind: text("kind").notNull().default("html"),
  /** 1 = official/primary. Phase 1 uses Tier-1 only. */
  tier: integer("tier").notNull().default(1),
  active: boolean("active").notNull().default(true),
  /** Keep in the registry for manual discovery, but exclude from automated collection. */
  discoveryOnly: boolean("discovery_only").notNull().default(false),
  /** What opportunity vertical this source produces: bursary | learnership | internship | job */
  opportunityType: text("opportunity_type").notNull().default("bursary"),
  /** Result of the last robots.txt check for this URL */
  robotsAllowed: boolean("robots_allowed"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastFetchStatus: text("last_fetch_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Source = typeof sourcesTable.$inferSelect;

/**
 * Raw snapshot of a fetched source — the audit trail for every fact we
 * publish, and the input to hash comparison in the freshness loop.
 */
export const sourceSnapshotsTable = pgTable("source_snapshots", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  sourceName: text("source_name"),
  contentHash: text("content_hash").notNull(),
  contentType: text("content_type"),
  httpStatus: integer("http_status"),
  /** Extracted text (HTML → readable text; PDFs/images → base64 kept separately) */
  contentText: text("content_text"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SourceSnapshot = typeof sourceSnapshotsTable.$inferSelect;

/**
 * AI extraction cache — keyed by (contentHash, promptVersion) so re-running
 * the pipeline never re-pays for an unchanged source.
 */
export const aiExtractionsTable = pgTable("ai_extractions", {
  id: serial("id").primaryKey(),
  contentHash: text("content_hash").notNull(),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  /** "extract" | "enrich" */
  step: text("step").notNull().default("extract"),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AiExtraction = typeof aiExtractionsTable.$inferSelect;
