/**
 * Import one official URL for the protected Admin "paste a link" workflow.
 *
 * The API server runs this command after admin authentication. It deliberately
 * disables automated publishing: the extracted record is always created as a
 * Draft for the founder to review and publish manually.
 */
import { db, pool, sourcesTable } from "@workspace/db";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { processSource } from "./collect";
import { normaliseHttpUrl, sha256 } from "./pipeline/util";

const [rawUrl, rawType, rawOpportunityType, rawFilename, rawOfficialUrl] = process.argv.slice(2);
const allowedTypes = new Set(["bursary", "learnership", "internship", "job"]);

async function main() {
  if (rawUrl === "--pdf") {
    const filePath = rawType;
    const opportunityType = allowedTypes.has(rawOpportunityType ?? "") ? rawOpportunityType! : "bursary";
    const filename = rawFilename || "official-advert.pdf";
    if (!rawOfficialUrl) throw new Error("An official webpage URL is required for PDF imports.");
    const officialUrl = rawOfficialUrl;
    const data = await readFile(filePath);
    if (data.length > 12 * 1024 * 1024) throw new Error("The PDF is too large. Maximum size is 12 MB.");
    const sourceName = `admin-pdf-import-${sha256(`${opportunityType}|${sha256(data)}`).slice(0, 16)}`;
    const [existing] = await db.select().from(sourcesTable).where(eq(sourcesTable.name, sourceName));
    const sourceUrl = officialUrl;
    if (!existing) {
      await db.insert(sourcesTable).values({
        name: sourceName,
        organisation: "Admin uploaded official PDF",
        url: sourceUrl,
        kind: "pdf",
        tier: 1,
        active: true,
        discoveryOnly: false,
        opportunityType,
        notes: `Uploaded by admin: ${filename}; verify source ownership during review.`,
      });
    } else {
      await db.update(sourcesTable).set({ url: sourceUrl, opportunityType, active: true, discoveryOnly: false }).where(eq(sourcesTable.id, existing.id));
    }
    try {
      const result = await processSource(sourceName, {
        allowAutoPublish: false,
        uploadedBinary: { data, filename, sourceUrl },
      });
      console.log(`[admin-import] ${JSON.stringify({ sourceName, sourceUrl, opportunityType, found: result.found, upserted: result.upserted, error: result.error ?? null, proof: result.proof })}`);
    } finally {
      await db.update(sourcesTable).set({ active: false }).where(eq(sourcesTable.name, sourceName));
    }
    return;
  }

  const url = normaliseHttpUrl(rawUrl ?? "");
  const opportunityType = allowedTypes.has(rawType ?? "") ? rawType! : "bursary";
  if (!url) throw new Error("A valid http(s) URL is required.");

  const sourceName = `admin-import-${sha256(`${opportunityType}|${url}`).slice(0, 16)}`;
  const [existing] = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.name, sourceName));

  if (!existing) {
    await db.insert(sourcesTable).values({
      name: sourceName,
      organisation: "Admin supplied source",
      url,
      kind: "html",
      tier: 1,
      active: true,
      discoveryOnly: false,
      opportunityType,
      notes: "Pasted by admin; verify official ownership during review.",
    });
  } else {
    await db
      .update(sourcesTable)
      .set({ url, opportunityType, active: true, discoveryOnly: false })
      .where(eq(sourcesTable.id, existing.id));
  }

  try {
    const result = await processSource(sourceName, { allowAutoPublish: false });
    console.log(`[admin-import] ${JSON.stringify({
      sourceName,
      url,
      opportunityType,
      found: result.found,
      upserted: result.upserted,
      error: result.error ?? null,
      proof: result.proof,
    })}`);
  } finally {
    // Admin-supplied links are one-off imports, not a new automated registry.
    await db
      .update(sourcesTable)
      .set({ active: false })
      .where(eq(sourcesTable.name, sourceName));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());