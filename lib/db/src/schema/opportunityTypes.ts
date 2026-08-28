import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Vertical configuration — adding a new opportunity vertical (e.g. "internship")
 * is a config row, not a schema rebuild. `urlPrefix` drives the public URL
 * (e.g. "bursaries" -> /bursaries/<slug>) and `schemaOrgType` drives the JSON-LD
 * structured data emitted on the page.
 */
export const opportunityTypesTable = pgTable("opportunity_types", {
  /** Machine name: bursary | learnership | internship | job (extensible) */
  type: text("type").primaryKey(),
  /** Human label, e.g. "Bursary" */
  label: text("label").notNull(),
  /** URL path prefix, e.g. "bursaries" */
  urlPrefix: text("url_prefix").notNull().unique(),
  /** JSON-LD type: "EducationalOccupationalProgram" | "JobPosting" etc. */
  schemaOrgType: text("schema_org_type").notNull(),
  /** Whether this vertical is live on the site */
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOpportunityTypeSchema = createInsertSchema(
  opportunityTypesTable,
).omit({ createdAt: true });
export type InsertOpportunityType = z.infer<typeof insertOpportunityTypeSchema>;
export type OpportunityType = typeof opportunityTypesTable.$inferSelect;
