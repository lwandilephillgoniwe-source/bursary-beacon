/**
 * Transparent checklist confidence score (spec Task 4, user-specified format):
 * integer points per check with a stored breakdown — NOT a black-box float.
 *
 * Checks (25 points each, max 100):
 *  - closing date found and parseable to a real date (or explicitly rolling)
 *  - eligibility text extracted
 *  - working official application link present (verified with a live request)
 *  - organisation identified
 *
 * Band: high >= 100, medium >= 75, low < 75.
 * OVERRIDE: missing/unparseable closing date (and not rolling) forces "low"
 * regardless of points — a bursary with no reliable deadline is the most
 * dangerous thing we can publish. Low band -> record stays in Draft.
 */
export type ConfidenceCheck = {
  check: string;
  points: number;
  awarded: boolean;
  reason: string;
};

export type ConfidenceResult = {
  points: number;
  band: "low" | "medium" | "high";
  breakdown: ConfidenceCheck[];
};

export function scoreConfidence(input: {
  closingDate: string | null;
  isRolling: boolean;
  eligibility: Record<string, unknown> | null;
  applicationLinkWorks: boolean;
  applicationUrl: string | null;
  organisation: string | null;
}): ConfidenceResult {
  const dateOk =
    input.isRolling ||
    (!!input.closingDate && !Number.isNaN(Date.parse(input.closingDate)));

  const breakdown: ConfidenceCheck[] = [
    {
      check: "Closing date found and parseable",
      points: 25,
      awarded: dateOk,
      reason: input.isRolling
        ? "Source states rolling/ongoing applications"
        : dateOk
          ? `Parsed as ${input.closingDate}`
          : "No unambiguous calendar date in the source",
    },
    {
      check: "Eligibility text extracted",
      points: 25,
      awarded: !!input.eligibility && Object.keys(input.eligibility).length > 0,
      reason: input.eligibility && Object.keys(input.eligibility).length > 0
        ? `Fields: ${Object.keys(input.eligibility).join(", ")}`
        : "No eligibility criteria found in the source",
    },
    {
      check: "Working official application link",
      points: 25,
      awarded: input.applicationLinkWorks,
      reason: input.applicationUrl
        ? input.applicationLinkWorks
          ? `${input.applicationUrl} responded OK`
          : `${input.applicationUrl} did not respond OK`
        : "No application link in the source",
    },
    {
      check: "Organisation identified",
      points: 25,
      awarded: !!input.organisation?.trim(),
      reason: input.organisation?.trim()
        ? `Organisation: ${input.organisation}`
        : "Organisation not identifiable from the source",
    },
  ];

  const points = breakdown.reduce((s, c) => s + (c.awarded ? c.points : 0), 0);
  let band: ConfidenceResult["band"] =
    points >= 100 ? "high" : points >= 75 ? "medium" : "low";
  if (!dateOk) band = "low"; // hard override per spec

  return { points, band, breakdown };
}

/** Legacy display helper; the collector's automated gate is stricter. */
export function bandMayPublish(band: ConfidenceResult["band"]): boolean {
  return band === "high" || band === "medium";
}
