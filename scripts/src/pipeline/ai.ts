import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, aiExtractionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), "../../prompts");

export const EXTRACT_PROMPT_VERSION = "extract-v4";
export const ENRICH_PROMPT_VERSION = "enrich-v1";
const MODEL = "gpt-5.6-terra";

function loadPrompt(version: string): string {
  return readFileSync(join(promptsDir, `${version}.md`), "utf8");
}

async function cached(
  contentHash: string,
  promptVersion: string,
  step: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(aiExtractionsTable)
    .where(
      and(
        eq(aiExtractionsTable.contentHash, contentHash),
        eq(aiExtractionsTable.promptVersion, promptVersion),
        eq(aiExtractionsTable.step, step),
      ),
    );
  return row?.result ?? null;
}

async function saveCache(
  contentHash: string,
  promptVersion: string,
  step: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(aiExtractionsTable)
    .values({ contentHash, promptVersion, step, model: MODEL, result });
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(cleaned) as Record<string, unknown>;
}

/**
 * Extract structured facts from source content. Supports plain text (from HTML)
 * and binary PDF/image adverts via the vision-capable Responses API.
 * Results are cached by (contentHash, promptVersion).
 */
export async function extractFacts(args: {
  contentHash: string;
  text?: string;
  binary?: { data: Buffer; mimeType: string; filename: string };
  binaries?: { data: Buffer; mimeType: string; filename: string }[];
}): Promise<Record<string, unknown>> {
  const hit = await cached(args.contentHash, EXTRACT_PROMPT_VERSION, "extract");
  if (hit) return hit;

  const prompt = loadPrompt(EXTRACT_PROMPT_VERSION);
  const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt }];
  const binaries = args.binaries?.length
    ? args.binaries
    : args.binary
      ? [args.binary]
      : [];
  if (binaries.length) {
    for (const binary of binaries.slice(0, 5)) {
      const b64 = binary.data.toString("base64");
      if (binary.mimeType === "application/pdf") {
      content.push({
        type: "input_file",
        filename: binary.filename,
        file_data: `data:application/pdf;base64,${b64}`,
      });
      } else {
      content.push({
        type: "input_image",
        image_url: `data:${binary.mimeType};base64,${b64}`,
      });
      }
    }
  } else {
    content.push({
      type: "input_text",
      text: `SOURCE CONTENT:\n\n${(args.text ?? "").slice(0, 60_000)}`,
    });
  }

  const response = await openai.responses.create({
    model: MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: [{ role: "user", content: content as any }],
  });
  const result = parseJson(response.output_text);
  await saveCache(args.contentHash, EXTRACT_PROMPT_VERSION, "extract", result);
  return result;
}

/** Generate labelled AI help strictly from extracted facts. Cached per fact-hash. */
export async function enrich(
  factsHash: string,
  facts: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const hit = await cached(factsHash, ENRICH_PROMPT_VERSION, "enrich");
  if (hit) return hit;

  const prompt = loadPrompt(ENRICH_PROMPT_VERSION);
  const response = await openai.responses.create({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_text", text: `VERIFIED FACTS:\n\n${JSON.stringify(facts, null, 2)}` },
        ],
      },
    ],
  });
  const result = parseJson(response.output_text);
  await saveCache(factsHash, ENRICH_PROMPT_VERSION, "enrich", result);
  return result;
}
