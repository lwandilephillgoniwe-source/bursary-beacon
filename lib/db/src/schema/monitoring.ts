import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Per-source collector run log. One row per source per collect run.
 * Used by the silent-failure detector to compare current record returns
 * against a rolling historical baseline — catches the case where a
 * collector runs "successfully" but returns ~0 records because the source
 * changed its HTML structure.
 */
export const collectorRunLogsTable = pgTable(
  "collector_run_logs",
  {
    id: serial("id").primaryKey(),
    sourceName: text("source_name").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    recordsFound: integer("records_found").notNull().default(0),
    recordsUpserted: integer("records_upserted").notNull().default(0),
    durationMs: integer("duration_ms"),
    error: text("error"),
  },
  (t) => [index("collector_run_logs_source_ran").on(t.sourceName, t.ranAt)],
);

/**
 * Monitoring alerts raised by the silent-failure detector.
 * Displayed prominently in the admin panel and can be POSTed to an
 * external webhook (email / Slack / WhatsApp) via the ALERT_WEBHOOK_URL
 * env var once that is configured.
 *
 * alert_type values:
 *   'silent_collector' — source fetched OK but suddenly returned ~0 records
 *   'source_quiet'     — source has not been run or confirmed anything in N days
 *   'source_error'     — fetch / extraction hard error this run
 */
export const monitoringAlertsTable = pgTable("monitoring_alerts", {
  id: serial("id").primaryKey(),
  alertType: text("alert_type").notNull(),
  sourceName: text("source_name").notNull(),
  message: text("message").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Explicit audit trail for the narrow collector auto-publish gate.
 * This is separate from the opportunity state history so an auditor can
 * query exactly what the automated publisher put live and why.
 */
export const autoPublishAuditsTable = pgTable("auto_publish_audits", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull(),
  title: text("title").notNull(),
  closingDate: text("closing_date").notNull(),
  confidenceBand: text("confidence_band").notNull(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CollectorRunLog = typeof collectorRunLogsTable.$inferSelect;
export type MonitoringAlert = typeof monitoringAlertsTable.$inferSelect;
export type AutoPublishAudit = typeof autoPublishAuditsTable.$inferSelect;
