import { date, index, pgTable, serial, text } from "drizzle-orm/pg-core";

/**
 * Aggregate / anonymous interest signals — groundwork for education-provider
 * lead-gen (Phase 4+). Captures what fields and provinces get traffic without
 * storing anything that could identify an individual student.
 *
 * ─────────────────────────────────────────────────────────────────────
 * POPIA GATE — strictly enforced
 * ─────────────────────────────────────────────────────────────────────
 * This table must NEVER store:
 *   - IP addresses or partial IPs
 *   - User IDs, session IDs, or cookies
 *   - Device fingerprints
 *   - Names, email addresses, or any directly identifying data
 *
 * Date-only granularity (not timestamp) is deliberate — it further reduces
 * re-identification risk by removing the timing dimension.
 *
 * Before any personal student data (CV, academic record, contact info) is
 * ever captured, the full POPIA compliance gate must be implemented:
 *   1. Explicit informed consent before processing
 *   2. Data minimisation
 *   3. Encryption at rest + in transit
 *   4. Secure authentication
 *   5. User data export + permanent deletion (right to erasure)
 *   6. Disclosure of cross-border AI processing
 *   7. Audit logging for all personal data access
 *   8. POPIA-compliant privacy policy update
 * See Phase 4 spec for the CV toolkit architecture plan.
 * ─────────────────────────────────────────────────────────────────────
 */
export const interestSignalsTable = pgTable(
  "interest_signals",
  {
    id: serial("id").primaryKey(),
    /** Opportunity vertical: 'bursary' | 'learnership' | 'internship' */
    opportunityType: text("opportunity_type").notNull(),
    /** Field of study from the viewed opportunity — may be null */
    fieldOfStudy: text("field_of_study"),
    /** Province from the viewed opportunity — may be null */
    province: text("province"),
    /** 'page_view' | 'apply_click' | 'hub_view' */
    signalType: text("signal_type").notNull().default("page_view"),
    /** Date only — never a timestamp; reduces fingerprinting risk */
    createdDate: date("created_date").notNull().defaultNow(),
  },
  (t) => [index("interest_signals_date").on(t.createdDate)],
);

export type InterestSignal = typeof interestSignalsTable.$inferSelect;
