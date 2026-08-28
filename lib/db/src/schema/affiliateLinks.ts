import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Configurable affiliate / referral links rendered contextually on opportunity
 * pages.  Placement controls where they appear:
 *   documents → after the "Documents you will need" card
 *   apply     → inside the "How to apply" card
 *   general   → after AI content, before related opportunities
 */
export const affiliateLinksTable = pgTable("affiliate_links", {
  id: serial("id").primaryKey(),
  /** Short anchor text shown to the user */
  label: text("label").notNull(),
  /** Full destination URL (swap for a real affiliate-tracked URL when live) */
  url: text("url").notNull(),
  /** One sentence explaining why this link is relevant */
  description: text("description"),
  /** documents | apply | general */
  placement: text("placement").notNull().default("general"),
  /** cv | course | laptop | general — for future personalisation */
  category: text("category").notNull().default("general"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliateLink = typeof affiliateLinksTable.$inferSelect;
