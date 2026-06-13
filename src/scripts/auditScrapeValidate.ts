import {
  CUTOFF_SECTION_PATTERNS,
  DROP_LINE_PATTERNS,
} from "../middleware/cleaningPatterns";
import type { ReadinessStatus } from "./auditScrapeManifest";

export interface ScrapedArticleRow {
  url?: string;
  title?: string;
  excerpt?: string;
  category?: string | null;
  body?: string;
  scrapedAt?: string;
  publishedAt?: string;
  success?: boolean;
  error?: string;
  articleItem?: unknown;
  [key: string]: unknown;
}

export interface ArticleValidationResult {
  url: string;
  title: string;
  valid: boolean;
  issues: string[];
  wordCount: number;
  bodyCharCount: number;
  missingPublishedAt: boolean;
  isLiveOrVideo: boolean;
  junkLineCount: number;
}

export interface SourceAuditResult {
  sourceKey: string;
  discovered: number;
  attempted: number;
  succeeded: number;
  failed: number;
  successRate: number;
  duplicateUrlCount: number;
  bodyLengthRange: { min: number; max: number; median: number } | null;
  bodyWordMedian: number | null;
  validationIssues: string[];
  articleValidations: ArticleValidationResult[];
  errors: string[];
  readiness: ReadinessStatus;
  recommendedFixes: string[];
  exampleSuccessTitle: string | null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function countJunkLines(body: string): number {
  const lines = body.split(/\n/);
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (DROP_LINE_PATTERNS.some((re) => re.test(trimmed))) count++;
    if (CUTOFF_SECTION_PATTERNS.some((re) => re.test(trimmed))) count++;
  }
  return count;
}

function isLiveOrVideoPage(article: ScrapedArticleRow): boolean {
  const url = (article.url || "").toLowerCase();
  const title = (article.title || "").toLowerCase();
  const body = (article.body || "").toLowerCase();
  if (/\/live(-blog)?\//.test(url) || /live updates|live blog/.test(title)) {
    return true;
  }
  if (/\/video\//.test(url) && wordCount(article.body || "") < 80) {
    return true;
  }
  if (/watch:|video:|play video/.test(body) && wordCount(article.body || "") < 80) {
    return true;
  }
  return false;
}

export function validateArticle(
  article: ScrapedArticleRow,
  seenUrls: Set<string>
): ArticleValidationResult {
  const issues: string[] = [];
  const url = (article.url || "").trim();
  const title = (article.title || "").trim();
  const body = (article.body || "").trim();
  const failed = article.success === false;

  if (!url) {
    issues.push("missing url");
  } else if (!isValidUrl(url)) {
    issues.push("invalid url");
  } else if (seenUrls.has(url)) {
    issues.push("duplicate url");
  } else {
    seenUrls.add(url);
  }

  if (!title) {
    issues.push("missing title");
  } else if (title.length < 10) {
    issues.push("title too short");
  }

  if (failed) {
    if (!article.error) issues.push("failed scrape without error message");
    if (body.length > 50) issues.push("failed scrape but body is non-empty");
  } else {
    if (!body) {
      issues.push("empty body");
    } else if (wordCount(body) < 50) {
      issues.push(`body too short (${wordCount(body)} words)`);
    }
  }

  const category = article.category;
  if (category === null || category === undefined || String(category).trim() === "") {
    issues.push("missing category");
  }

  if (!article.publishedAt && !article.scrapedAt) {
    issues.push("missing publishedAt and scrapedAt");
  }

  const junkLineCount = body ? countJunkLines(body) : 0;
  if (junkLineCount >= 3) {
    issues.push(`body contains ${junkLineCount} junk/promo lines`);
  }

  const liveOrVideo = isLiveOrVideoPage(article);
  if (liveOrVideo) {
    issues.push("appears to be liveblog or video-only page");
  }

  return {
    url: url || "(none)",
    title: title || "(none)",
    valid: issues.length === 0,
    issues,
    wordCount: wordCount(body),
    bodyCharCount: body.length,
    missingPublishedAt: !article.publishedAt,
    isLiveOrVideo: liveOrVideo,
    junkLineCount,
  };
}

export function sanitizeArticle(article: ScrapedArticleRow): ScrapedArticleRow {
  const { articleItem, ...rest } = article;
  return rest;
}

export function auditSourceArticles(
  sourceKey: string,
  articles: ScrapedArticleRow[],
  discovered: number,
  scrapeErrors: string[],
  tosRisk: "low" | "medium" | "high"
): SourceAuditResult {
  const seenUrls = new Set<string>();
  const articleValidations = articles.map((a) => validateArticle(a, seenUrls));

  const succeeded = articles.filter((a) => a.success !== false).length;
  const failed = articles.filter((a) => a.success === false).length;
  const attempted = articles.length;
  const successRate = attempted > 0 ? succeeded / attempted : 0;

  const duplicateUrlCount = articleValidations.filter((v) =>
    v.issues.includes("duplicate url")
  ).length;

  const successfulBodies = articles
    .filter((a) => a.success !== false && (a.body || "").trim())
    .map((a) => (a.body || "").length);

  const successfulWordCounts = articles
    .filter((a) => a.success !== false && (a.body || "").trim())
    .map((a) => wordCount(a.body || ""));

  const bodyLengthRange =
    successfulBodies.length > 0
      ? {
          min: Math.min(...successfulBodies),
          max: Math.max(...successfulBodies),
          median: median(successfulBodies),
        }
      : null;

  const bodyWordMedian =
    successfulWordCounts.length > 0 ? median(successfulWordCounts) : null;

  const validationIssues = [
    ...new Set(articleValidations.flatMap((v) => v.issues)),
  ];

  const errors = [...scrapeErrors];
  for (const a of articles) {
    if (a.success === false && a.error) errors.push(a.error);
  }

  const successfulValid = articleValidations.filter(
    (v, i) => articles[i].success !== false && v.valid
  );
  const exampleSuccess = articles.find(
    (a) => a.success !== false && (a.title || "").trim()
  );

  const recommendedFixes: string[] = [];
  if (attempted === 0) {
    recommendedFixes.push("Scraper returned zero articles — check section URL and list selectors");
  }
  if (validationIssues.includes("empty body")) {
    recommendedFixes.push("Update article body CSS selectors or JSON-LD parsing");
  }
  if (validationIssues.some((i) => i.includes("junk"))) {
    recommendedFixes.push("Apply or extend cleanArticleBody before storage");
  }
  if (errors.some((e) => /403|429|blocked|captcha/i.test(e))) {
    recommendedFixes.push("Request blocked — add User-Agent, backoff, or use official feed/API");
  }
  if (tosRisk === "high") {
    recommendedFixes.push("Legal review recommended before production republish of full text");
  }

  let readiness = classifyReadiness({
    attempted,
    successRate,
    successfulValidCount: successfulValid.length,
    succeeded,
    bodyWordMedian,
    errors,
    validationIssues,
    tosRisk,
  });

  return {
    sourceKey,
    discovered,
    attempted,
    succeeded,
    failed,
    successRate,
    duplicateUrlCount,
    bodyLengthRange,
    bodyWordMedian,
    validationIssues,
    articleValidations,
    errors: [...new Set(errors)].slice(0, 10),
    readiness,
    recommendedFixes,
    exampleSuccessTitle: exampleSuccess?.title || null,
  };
}

function classifyReadiness(args: {
  attempted: number;
  successRate: number;
  successfulValidCount: number;
  succeeded: number;
  bodyWordMedian: number | null;
  errors: string[];
  validationIssues: string[];
  tosRisk: "low" | "medium" | "high";
}): ReadinessStatus {
  const blocked = args.errors.some((e) =>
    /403|429|blocked|captcha|ECONNREFUSED|timeout/i.test(e)
  );

  if (args.attempted === 0 || (args.succeeded === 0 && args.attempted > 0)) {
    return blocked ? "disable for MVP" : "needs major fixes";
  }

  if (blocked && args.successRate < 0.5) {
    return "disable for MVP";
  }

  if (
    args.validationIssues.includes("appears to be liveblog or video-only page") &&
    args.successRate < 0.5
  ) {
    return "disable for MVP";
  }

  const allSuccessfulValid =
    args.succeeded > 0 && args.successfulValidCount === args.succeeded;
  const goodBody =
    args.bodyWordMedian !== null && args.bodyWordMedian >= 200;

  if (args.successRate >= 0.8 && allSuccessfulValid && goodBody) {
    return args.tosRisk === "high" ? "needs minor fixes" : "ready";
  }

  if (args.successRate >= 0.5) {
    return "needs minor fixes";
  }

  return "needs major fixes";
}
