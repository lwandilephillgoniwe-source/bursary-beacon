import { chromium, type Browser, type Page } from "playwright";
import type { Source } from "@workspace/db";
import { htmlToText, isSafePublicUrl, robotsAllows } from "./util";

const PAGE_LINK_TERMS = [
  "bursary",
  "bursaries",
  "scholarship",
  "scholarships",
  "learnership",
  "learnerships",
  "careers",
  "apply",
];

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

export type HeadlessPage = {
  url: string;
  html: string;
  contentType: string;
  httpStatus: number;
  fromHomepage: boolean;
};

export type HeadlessFetchResult =
  | { ok: true; page: HeadlessPage }
  | { ok: false; reason: string; httpStatus?: number };

function isHomepageLike(url: string): boolean {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
  return path === "" || path === "/" || path === "/content" || path === "/home";
}

function bursaryCandidates(html: string, baseUrl: string): string[] {
  const candidates: { url: string; score: number }[] = [];
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRe)) {
    const href = match[1];
    const anchorText = htmlToText(match[2]).toLowerCase();
    const haystack = `${href} ${anchorText}`.toLowerCase();
    const matchedTerms = PAGE_LINK_TERMS.filter((term) => haystack.includes(term));
    const hasBursaryTerm = /bursar(?:y|ies)|scholarships?/i.test(haystack);
    if (!matchedTerms.length || !hasBursaryTerm) continue;

    try {
      const candidate = new URL(href, baseUrl);
      if (candidate.origin !== new URL(baseUrl).origin) continue;
      candidate.hash = "";
      if (candidate.toString() === baseUrl) continue;
      const score =
        matchedTerms.length * 10 +
        (hasBursaryTerm ? 100 : 0) +
        (candidate.pathname.length > 1 ? 1 : 0);
      if (!candidates.some((item) => item.url === candidate.toString())) {
        candidates.push({ url: candidate.toString(), score });
      }
    } catch {
      // Ignore malformed links.
    }
  }

  return candidates.sort((a, b) => b.score - a.score).map((item) => item.url);
}

async function navigate(page: Page, url: string): Promise<HeadlessFetchResult> {
  if (!(await isSafePublicUrl(url))) {
    return { ok: false, reason: "unsafe or unresolvable URL" };
  }
  if (!(await robotsAllows(url))) {
    return { ok: false, reason: "blocked by robots.txt" };
  }

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(1_500);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    const status = response?.status() ?? 200;
    const finalUrl = page.url();
    if (!(await isSafePublicUrl(finalUrl))) {
      return { ok: false, reason: "unsafe redirect target" };
    }
    if (status < 200 || status >= 300) {
      return { ok: false, reason: `HTTP ${status}`, httpStatus: status };
    }

    const html = await page.content();
    if (!htmlToText(html).trim()) {
      return { ok: false, reason: "rendered page has no readable content", httpStatus: status };
    }

    return {
      ok: true,
      page: {
        url: finalUrl,
        html,
        contentType: response?.headers()["content-type"] ?? "text/html; charset=utf-8",
        httpStatus: status,
        fromHomepage: false,
      },
    };
  } catch (error) {
    return { ok: false, reason: `headless fetch error: ${(error as Error).message}` };
  }
}

async function createBrowserPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    locale: "en-ZA",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Keep every browser request subject to the same public-network SSRF and
  // robots boundary as plain fetches. This is deliberately stricter than only
  // checking the top-level document: browser subresources must not bypass it.
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!/^https?:\/\//i.test(request.url())) {
      await route.continue();
      return;
    }
    if (!(await isSafePublicUrl(request.url()))) {
      await route.abort("blockedbyclient");
      return;
    }
    if (!(await robotsAllows(request.url()))) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  return page;
}

/**
 * One unattended browser fallback. It is intentionally separate from the
 * normal fetch path so callers can prove exactly when browser work occurred.
 */
export async function fetchWithHeadlessBrowser(source: Source): Promise<HeadlessFetchResult> {
  if (!(await isSafePublicUrl(source.url))) {
    return { ok: false, reason: "unsafe or unresolvable URL" };
  }
  if (!(await robotsAllows(source.url))) {
    return { ok: false, reason: "blocked by robots.txt" };
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await createBrowserPage(browser);

    const first = await navigate(page, source.url);
    if (!first.ok) return first;

    if (!isHomepageLike(source.url)) {
      return first;
    }

    const candidates = bursaryCandidates(first.page.html, first.page.url).slice(0, 12);
    for (const candidate of candidates) {
      const result = await navigate(page, candidate);
      if (result.ok) {
        return {
          ok: true,
          page: { ...result.page, fromHomepage: true },
        };
      }
      if (result.reason === "blocked by robots.txt") continue;
    }

    return { ok: false, reason: "no bursary page found after headless rendering" };
  } catch (error) {
    return { ok: false, reason: `headless browser unavailable: ${(error as Error).message}` };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}