/**
 * Phase 0 seed: vertical config + one REAL, currently-open bursary,
 * hand-entered from the official source (Sasol media release, 1 Aug 2026).
 * Idempotent — safe to run more than once.
 */
import {
  db,
  opportunitiesTable,
  opportunityTypesTable,
  pool,
  type InsertOpportunity,
} from "@workspace/db";

const types = [
  { type: "bursary", label: "Bursary", urlPrefix: "bursaries", schemaOrgType: "EducationalOccupationalProgram", enabled: true },
  { type: "learnership", label: "Learnership", urlPrefix: "learnerships", schemaOrgType: "EducationalOccupationalProgram", enabled: false },
  { type: "internship", label: "Internship", urlPrefix: "internships", schemaOrgType: "JobPosting", enabled: false },
  { type: "job", label: "Job", urlPrefix: "jobs", schemaOrgType: "JobPosting", enabled: false },
];

const now = new Date();

const sasol: InsertOpportunity = {
  slug: "sasol-foundation-bursary-2027",
  type: "bursary",
  title: "Sasol Foundation Bursary Programme 2027",
  organisation: "Sasol Foundation",
  province: "National",
  fieldOfStudy:
    "STEM: Engineering, Engineering Technology, Information Technology, Data Science, Environmental Sciences; limited non-STEM including Accounting and Financial Sciences",
  officialSourceUrl:
    "https://www.sasol.com/media-centre/media-releases/sasol-foundation-invites-applications-2027-bursaries",
  officialApplicationUrl: "https://www.sasolbursaries.com/",
  opensDate: "2026-08-01",
  closingDate: "2026-08-23",
  isRolling: false,
  eligibility: {
    whoItIsFor: [
      "Academically talented learners and students from Sasol's local communities",
      "Children of Sasol employees",
      "Children of Sasol Khanyisa shareholders",
    ],
    financialNeed:
      "Aimed at learners and students from low-income and missing middle households",
    studyYear: "Full-time undergraduate studies starting in 2027",
  },
  requirements: [
    "Enrolment for full-time undergraduate studies in 2027",
    "Demonstrated academic potential",
    "Full qualifying criteria are listed on the official application site (sasolbursaries.com)",
  ],
  requiredDocuments: [],
  extractedFacts: {
    programme: "Sasol Foundation bursary programme, 2027 intake",
    coverage:
      "All-inclusive undergraduate bursary with wrap-around support programmes (academic success, personal development, work readiness)",
    applicationWindow: "1 August 2026 to 23 August 2026",
    announcementDate: "2026-08-01",
  },
  aiSummary:
    "The Sasol Foundation is offering all-inclusive bursaries for undergraduate studies starting in 2027. It is aimed at talented students from Sasol's local communities, children of Sasol employees, and children of Sasol Khanyisa shareholders — especially from low-income and missing-middle households. It mainly funds STEM degrees, with a small number of places for fields like Accounting. Beyond fees, bursars get academic, personal and work-readiness support. Applications close on 23 August 2026, so apply on sasolbursaries.com before then.",
  aiChecklist: [
    "Check you fall into one of the qualifying groups (Sasol community, employee's child, or Khanyisa shareholder's child)",
    "Confirm your intended 2027 degree is in a funded discipline",
    "Gather your latest academic results",
    "Apply on sasolbursaries.com before 23 August 2026",
  ],
  status: "published",
  lastFetchedAt: now,
  lastConfirmedAt: now,
  seoTitle: "Sasol Foundation Bursary 2027 — Who Qualifies, Closing Date & How to Apply",
  metaDescription:
    "Sasol Foundation Bursary Programme 2027: all-inclusive bursaries for STEM and selected other degrees. Closes 23 August 2026. Verified against the official Sasol announcement.",
  stateHistory: [
    { at: now.toISOString(), from: null, to: "published", note: "Hand-entered from official Sasol media release (Phase 0)" },
  ],
};

async function main() {
  for (const t of types) {
    await db
      .insert(opportunityTypesTable)
      .values(t)
      .onConflictDoUpdate({ target: opportunityTypesTable.type, set: t });
  }
  const [row] = await db
    .insert(opportunitiesTable)
    .values(sasol)
    .onConflictDoUpdate({ target: opportunitiesTable.slug, set: sasol })
    .returning({ id: opportunitiesTable.id, slug: opportunitiesTable.slug });
  console.log(`[seed] upserted ${types.length} vertical configs and opportunity #${row.id} (${row.slug})`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
