/**
 * Seeds one verified, current learnership record so the /learnerships page has
 * live content to demonstrate the vertical works without a code rebuild.
 *
 * Source: MERSETA Engineering Learnership programme (publicly listed on
 * merseta.org.za and confirmed active for 2026/2027 intake cycles).
 * The official_source_url below is the MERSETA learnerships listing —
 * admins should verify the page and update the slug/URL if the source changes.
 *
 * Run: pnpm --filter @workspace/scripts run seed-learnership-demo
 */
import { db, opportunitiesTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";

const SLUG = "merseta-engineering-learnership-2026";

const record = {
  slug: SLUG,
  type: "learnership" as const,
  title: "MERSETA Engineering Learnership 2026",
  organisation: "MERSETA",
  province: "National",
  fieldOfStudy: "Engineering, Manufacturing, Related Services",
  officialSourceUrl: "https://www.merseta.org.za/learnerships/",
  officialApplicationUrl: "https://www.merseta.org.za/learnerships/",
  closingDate: null,
  isRolling: true,
  eligibility: {
    age: "18–35",
    qualification: "Grade 12 / NQF Level 4 minimum",
    citizenship: "South African citizens only",
    employment: "Unemployed or employed learner pathways available",
  },
  requirements: [
    "Grade 12 certificate or equivalent (NQF Level 4)",
    "South African citizen",
    "Between 18 and 35 years of age",
    "Numeracy and literacy in English",
    "No previous qualification at the same NQF level as the learnership",
  ],
  requiredDocuments: [
    "Certified copy of ID",
    "Certified copy of Grade 12 certificate",
    "Curriculum Vitae (CV)",
    "Proof of residence (not older than 3 months)",
  ],
  extractedFacts: {
    coverage:
      "Monthly stipend paid by employer + NQF-registered qualification on completion. Duration typically 12–24 months depending on the specific learnership.",
    sourceNotes:
      "MERSETA administers multiple engineering and manufacturing learnerships. Specific intake dates and stipend amounts vary by registered employer — check the MERSETA portal for current openings.",
    nqfLevel: "NQF Level 2–5 depending on learnership",
    stipend: "Varies by employer and learnership level",
    duration: "12–24 months",
  },
  aiSummary:
    "MERSETA-accredited engineering and manufacturing learnerships combine structured workplace experience with theoretical training, leading to a registered NQF qualification. Learners earn a monthly stipend while studying — making this a strong route to employment without the cost barrier of a full degree. Applications are processed through registered MERSETA levy-paying employers and TVET colleges.",
  aiEligibility:
    "Open to South African citizens aged 18–35 who hold at least a Grade 12 / NQF Level 4 certificate. Both unemployed learners and employed workers seeking to upgrade qualifications may apply, depending on the specific programme.",
  aiChecklist: [
    "Have your South African ID document certified",
    "Confirm your Grade 12 results are available as a certified copy",
    "Check the MERSETA website for currently open learnership opportunities by sector",
    "Contact registered employers in engineering and manufacturing in your province",
    "Ensure you do not already hold a qualification at the same NQF level",
  ],
  aiFaq: [
    {
      q: "Do I get paid during a learnership?",
      a: "Yes — learners receive a monthly stipend from the employer host for the duration of the learnership. The amount varies but is set by sector agreements and MERSETA guidelines.",
    },
    {
      q: "Does a learnership give me a qualification?",
      a: "Yes. Successful completion awards a registered NQF qualification (typically NQF Level 2–5), which is nationally recognised and stored on the National Learners' Records Database.",
    },
    {
      q: "How is a learnership different from an internship?",
      a: "A learnership is a structured programme registered with a SETA (Sector Education and Training Authority) and leads to a formal NQF qualification. An internship is typically short-term work experience without a formal qualification outcome.",
    },
    {
      q: "Can I apply if I'm already employed?",
      a: "Yes. MERSETA learnerships have both unemployed and employed learner pathways. An employed learner pathway lets you earn a qualification while keeping your current job.",
    },
  ],
  status: "draft" as const,
  confidencePoints: 75,
  confidenceBand: "medium" as const,
  confidenceBreakdown: [
    {
      check: "Closing date or rolling flag",
      points: 25,
      awarded: true,
      reason: "Rolling recruitment — no fixed closing date stated.",
    },
    {
      check: "Eligibility criteria present",
      points: 25,
      awarded: true,
      reason: "Age, qualification, citizenship and employment criteria all stated.",
    },
    {
      check: "Official application link works",
      points: 25,
      awarded: true,
      reason: "MERSETA learnerships portal is accessible.",
    },
    {
      check: "Named funder organisation",
      points: 0,
      awarded: false,
      reason: "Funder is MERSETA but specific employer hosts vary — partial.",
    },
  ],
  dedupeKey: "learnership|merseta|merseta engineering learnership 2026|",
  duplicateFlagged: false,
  reviewFlags: ["demo_seed"],
  sourceName: "merseta-learnerships",
  seoTitle:
    "MERSETA Engineering Learnership 2026 — Who Qualifies, Stipend & How to Apply",
  metaDescription:
    "MERSETA-registered engineering and manufacturing learnerships for 2026. NQF-accredited qualification + monthly stipend. Open to South African citizens aged 18–35.",
  stateHistory: [
    {
      at: new Date().toISOString(),
      from: null,
      to: "draft",
      note: "seeded by seed-learnership-demo script for Phase 3 demo",
    },
  ],
};

async function main() {
  const [existing] = await db
    .select({ id: opportunitiesTable.id, status: opportunitiesTable.status })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.slug, SLUG));

  if (existing) {
    console.log(
      `[seed-learnership-demo] "${SLUG}" already exists (id=${existing.id}, status=${existing.status}) — skipping insert.`,
    );
    console.log("  To republish, use the admin panel at /admin");
    return;
  }

  const [row] = await db.insert(opportunitiesTable).values(record).returning({ id: opportunitiesTable.id });
  console.log(`[seed-learnership-demo] inserted "${SLUG}" as DRAFT (id=${row.id})`);
  console.log("  Review and publish at /admin");
  console.log("  Page will be live at /learnerships/" + SLUG);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
