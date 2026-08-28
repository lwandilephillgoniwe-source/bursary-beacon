/**
 * Seed configurable affiliate / referral links.
 * Idempotent — skips rows whose label already exists.
 * Swap the URL values for real affiliate-tracked URLs once partner accounts
 * are set up. The system is ready to earn; only the URLs need updating.
 */
import { db, pool, affiliateLinksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const LINKS = [
  // ── DOCUMENTS placement ─────────────────────────────────────────────────
  {
    label: "Write a standout CV (free guide)",
    url: "https://www.coursera.org/articles/how-to-write-a-cv",
    description: "Step-by-step CV writing guide — many bursaries require one.",
    placement: "documents",
    category: "cv",
  },
  {
    label: "Free CV templates (Canva)",
    url: "https://www.canva.com/resumes/templates/",
    description: "Professional CV templates you can edit online for free.",
    placement: "documents",
    category: "cv",
  },
  // ── APPLY placement ──────────────────────────────────────────────────────
  {
    label: "Laptop & tablet deals on Takealot",
    url: "https://www.takealot.com/computers/laptops",
    description: "A reliable laptop makes online applications and studying easier.",
    placement: "apply",
    category: "laptop",
  },
  // ── GENERAL placement ────────────────────────────────────────────────────
  {
    label: "Free online courses (Coursera)",
    url: "https://www.coursera.org/courses?query=free",
    description: "Build skills in engineering, finance, IT and more — many courses are free to audit.",
    placement: "general",
    category: "course",
  },
  {
    label: "Career skills on Udemy",
    url: "https://www.udemy.com/courses/personal-development/career-development/",
    description: "Affordable short courses on interview prep, workplace skills, and more.",
    placement: "general",
    category: "course",
  },
  {
    label: "FundiConnect — bursaries & career advice",
    url: "https://www.fundiconnect.com/bursaries/",
    description: "Another good source of SA bursary listings and career-readiness tips.",
    placement: "general",
    category: "general",
  },
];

async function main() {
  let upserted = 0;
  for (const link of LINKS) {
    const [existing] = await db
      .select({ id: affiliateLinksTable.id })
      .from(affiliateLinksTable)
      .where(eq(affiliateLinksTable.label, link.label));
    if (existing) {
      console.log(`- skip (exists): ${link.label}`);
      continue;
    }
    await db.insert(affiliateLinksTable).values(link);
    console.log(`+ inserted: ${link.label}`);
    upserted++;
  }
  console.log(`\n[affiliate-seed] done. ${upserted} new links inserted.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
