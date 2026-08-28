import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Background-job proof table. Every run of the heartbeat job (script or
 * protected endpoint) inserts a row. If rows keep appearing while nobody has
 * the project open, unattended scheduling works.
 */
export const heartbeatsTable = pgTable("heartbeats", {
  id: serial("id").primaryKey(),
  /** "script" (Scheduled Deployment entrypoint) or "endpoint" (external cron) */
  source: text("source").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Heartbeat = typeof heartbeatsTable.$inferSelect;
