/**
 * Read-only single-source inspection: discovery, scrape, normalization preview,
 * optional Supabase lookup. No OpenAI, Sanity, inserts, or status changes.
 */

import * as fs from "fs";
import * as path from "path";
import { scraperSwitches } from "../config/scraperSwitches";
import type { SourceKey } from "../config/scrapingControl";
import { getSourceScrapeLimit } from "../config/sourceScrapeLimits";
import { runSourceScraper } from "../core/scraperDispatch";
import { lookupStoryCandidatesBySourceUrls } from "../db/storyCandidates";
import { hasSupabaseEnv } from "../db/supabaseClient";
import { discoverSourceArticles } from "../inspect/discoveryDispatch";
import { normalizeStoryCandidate } from "../normalization/normalizeStoryCandidate";
import { getSourceMetadata } from "../normalization/sourceMetadata";
import type { NormalizedStoryCandidate, RawScrapedArticle } from "../normalization/types";
import { validateNormalizedCandidate } from "../normalization/validateNormalizedCandidate";
import { getManifestEntry } from "./auditScrapeManifest";
import { getLatestResultFilePath } from "../utils/scraperUtils";

const VALID_SOURCE_KEYS = Object.keys(scraperSwitches).sort() as SourceKey[];
const VALID_SOURCE_KEY_SET = new Set<string>(VALID_SOURCE_KEYS);

const BODY_PREVIEW_LENGTH = 240;

interface ScrapedArticleRow extends RawScrapedArticle {
  url?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  publishedAt?: string;
  scrapedAt?: string;
  success?: boolean;
  error?: string;
}

interface ScrapeSummaryRow {
  url: string;
  success: boolean;
  title: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  scrapedAt: string | null;
  bodyWordCount: number;
  bodyCharCount: number;
  bodyPreview: string;
  error: string | null;
}

interface NormalizationPreviewEntry {
  url: string;
  candidate: NormalizedStoryCandidate;
  validation: { valid: boolean; reasons: string[] };
  bodyWordCount: number;
}

interface NormalizationSummaryEntry {
  url: string;
  valid: boolean;
  reasons: string[];
  bodyWordCount: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}

function parseSourceKey(): SourceKey | null {
  const raw = parseArgValue("source") || process.env.INSPECT_SOURCE_KEY?.trim();
  if (!raw) return null;
  return raw as SourceKey;
}

function parseLimit(sourceKey: SourceKey): { limit: number; isOverride: boolean } {
  const raw = parseArgValue("limit") ?? process.env.INSPECT_LIMIT;
  const scraperDefault = getSourceScrapeLimit(sourceKey);

  if (raw === undefined || raw.trim() === "") {
    return { limit: scraperDefault, isOverride: false };
  }

  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return { limit: scraperDefault, isOverride: false };
  }

  return { limit: Math.min(10, Math.max(1, parsed)), isOverride: true };
}

function printInvalidSourceHelp(provided: string): void {
  console.error(`Invalid source key: ${provided}`);
  console.error("");
  console.error("Valid source keys:");
  for (const key of VALID_SOURCE_KEYS) {
    console.error(`  - ${key}`);
  }
  console.error("");
  console.error("Example:");
  console.error("  npm run scraper:inspect -- --source=apNewsUS");
  console.error("  npm run scraper:inspect -- --source=apNewsUS --limit=3");
  console.error("  INSPECT_SOURCE_KEY=apNewsUS npm run scraper:inspect");
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function buildCommandLine(sourceKey: SourceKey, limit: number): string {
  return `npm run scraper:inspect -- --source=${sourceKey} --limit=${limit}`;
}

function buildScrapeSummary(articles: ScrapedArticleRow[]): ScrapeSummaryRow[] {
  return articles.map((article) => {
    const body = String(article.body ?? "");
    return {
      url: String(article.url ?? ""),
      success: article.success === true,
      title: article.title ?? null,
      excerpt: article.excerpt ?? null,
      publishedAt: article.publishedAt ?? null,
      scrapedAt: article.scrapedAt ?? null,
      bodyWordCount: countWords(body),
      bodyCharCount: body.length,
      bodyPreview: body.slice(0, BODY_PREVIEW_LENGTH),
      error: article.error ?? null,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function buildInspectionReport(params: {
  command: string;
  sourceKey: SourceKey;
  limit: number;
  outputDir: string;
  resultsFilePath: string | null;
  metadata: Record<string, unknown>;
  discovery: Awaited<ReturnType<typeof discoverSourceArticles>>;
  scrapeSummary: ScrapeSummaryRow[];
  normalizationSummary: {
    total: number;
    passed: number;
    failed: number;
    entries: NormalizationSummaryEntry[];
  };
  supabaseLookup: Record<string, unknown>;
  warnings: string[];
  healthVerdict: "healthy" | "needs attention";
}): string {
  const {
    command,
    sourceKey,
    limit,
    outputDir,
    resultsFilePath,
    metadata,
    discovery,
    scrapeSummary,
    normalizationSummary,
    supabaseLookup,
    warnings,
    healthVerdict,
  } = params;

  const scrapeSucceeded = scrapeSummary.filter((row) => row.success).length;
  const scrapeFailed = scrapeSummary.length - scrapeSucceeded;
  const publishedAtCount = scrapeSummary.filter((row) => row.publishedAt).length;
  const bodyWordCounts = scrapeSummary.map((row) => row.bodyWordCount);
  const supabaseEnabled = supabaseLookup.enabled === true;
  const supabaseRows = Array.isArray(supabaseLookup.results)
    ? (supabaseLookup.results as Array<{ existsInSupabase?: boolean }>)
    : [];
  const supabaseExistsCount = supabaseRows.filter((row) => row.existsInSupabase).length;

  const lines: string[] = [
    `# Scraper Inspection Report: ${sourceKey}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Command",
    "",
    "```bash",
    command,
    "```",
    "",
    "## Source metadata",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| sourceKey | ${metadata.sourceKey} |`,
    `| displayName | ${metadata.displayName} |`,
    `| publisher | ${metadata.publisher} |`,
    `| category | ${metadata.category} |`,
    `| sectionUrl | ${metadata.sectionUrl} |`,
    `| wrapperFile | ${metadata.wrapperFile} |`,
    `| implementationFile | ${metadata.implementationFile} |`,
    `| extractionMethod | ${metadata.extractionMethod} |`,
    `| tosRisk | ${metadata.tosRisk} |`,
    `| readiness | ${metadata.readiness} |`,
    `| scraperDefaultLimit | ${metadata.scraperDefaultLimit} |`,
    `| articleLimit | ${metadata.articleLimit} |`,
    `| limitSource | ${metadata.limitSource} |`,
    "",
    "## Discovery",
    "",
    `- Discovery cap: ${discovery.discoveryCap}`,
    `- Raw discovered items: ${discovery.rawDiscoveredCount}`,
    `- Unique discovered URLs: ${discovery.discoveredUrls.length}`,
    `- Duplicate URLs: ${discovery.duplicateDiscoveredUrls.length}`,
    `- Selected for scrape: ${discovery.selectedUrls.length} (limit ${limit})`,
    `- Skipped URLs: ${discovery.skippedUrls.length}`,
    "",
    "## Scrape",
    "",
    `- Attempted: ${scrapeSummary.length}`,
    `- Succeeded: ${scrapeSucceeded}`,
    `- Failed: ${scrapeFailed}`,
    `- publishedAt coverage: ${publishedAtCount}/${scrapeSummary.length}`,
    `- Body word count median: ${median(bodyWordCounts) ?? "n/a"}`,
    `- Results file: ${resultsFilePath ?? "n/a"}`,
    "",
    "## Normalization preview",
    "",
    `- Passed validation: ${normalizationSummary.passed}/${normalizationSummary.total}`,
    `- Failed validation: ${normalizationSummary.failed}/${normalizationSummary.total}`,
    "",
  ];

  if (supabaseEnabled) {
    lines.push(
      "## Supabase lookup (read-only)",
      "",
      `- URLs checked: ${supabaseRows.length}`,
      `- Already in Supabase: ${supabaseExistsCount}/${supabaseRows.length}`,
      ""
    );
  } else {
    lines.push(
      "## Supabase lookup (read-only)",
      "",
      `- Enabled: false`,
      `- Reason: ${String(supabaseLookup.reason ?? "unknown")}`,
      ""
    );
  }

  lines.push("## Warnings / issues", "");
  if (warnings.length === 0) {
    lines.push("- None");
  } else {
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Health verdict",
    "",
    `**${healthVerdict}**`,
    "",
    "## Output files",
    "",
    `- ${path.join(outputDir, "source-metadata.json")}`,
    `- ${path.join(outputDir, "discovery.json")}`,
    `- ${path.join(outputDir, "raw-articles.json")}`,
    `- ${path.join(outputDir, "scrape-summary.json")}`,
    `- ${path.join(outputDir, "normalized-preview.json")}`,
    `- ${path.join(outputDir, "normalization-summary.json")}`,
    `- ${path.join(outputDir, "supabase-lookup.json")}`,
    `- ${path.join(outputDir, "INSPECTION_REPORT.md")}`,
    ""
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const sourceKey = parseSourceKey();

  if (!sourceKey) {
    console.error("Missing required source key.");
    console.error("");
    printInvalidSourceHelp("(none provided)");
    process.exit(1);
  }

  if (!VALID_SOURCE_KEY_SET.has(sourceKey)) {
    printInvalidSourceHelp(sourceKey);
    process.exit(1);
  }

  const { limit, isOverride } = parseLimit(sourceKey);
  const scraperDefaultLimit = getSourceScrapeLimit(sourceKey);

  const command = buildCommandLine(sourceKey, limit);
  const outputDir = path.join(process.cwd(), "audit-output", "inspect", sourceKey);
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = getManifestEntry(sourceKey);
  const normMeta = getSourceMetadata(sourceKey);

  const sourceMetadata = {
    sourceKey,
    displayName: manifest.displayName,
    publisher: normMeta?.publisher ?? null,
    category: normMeta?.defaultCategory ?? null,
    sectionUrl: manifest.sectionUrl,
    wrapperFile: manifest.wrapperPath,
    implementationFile: manifest.sourcePath,
    extractionMethod: manifest.extractionMethod,
    tosRisk: manifest.tosRisk,
    readiness: normMeta?.readiness ?? null,
    requiresLegalReview: normMeta?.requiresLegalReview ?? null,
    scraperDefaultLimit,
    articleLimit: limit,
    limitSource: isOverride ? "override" : "scraper-default",
  };

  writeJson(path.join(outputDir, "source-metadata.json"), sourceMetadata);

  console.log(`Inspecting source: ${sourceKey}`);
  console.log(`Section URL: ${manifest.sectionUrl}`);
  console.log(
    `Article limit: ${limit}${isOverride ? " (override)" : ` (scraper default: ${scraperDefaultLimit})`}`
  );

  const discovery = await discoverSourceArticles(sourceKey, limit);
  writeJson(path.join(outputDir, "discovery.json"), discovery);

  console.log(`Discovered: ${discovery.discoveredUrls.length} URLs`);
  console.log(`Selected: ${discovery.selectedUrls.length} URLs`);

  await runSourceScraper(sourceKey, limit, { skipEnabledCheck: true });

  const resultsFilePath = getLatestResultFilePath(sourceKey);
  let rawPayload: Record<string, unknown> = {
    metadata: null,
    homepageItems: [],
    articles: [],
  };

  if (resultsFilePath && fs.existsSync(resultsFilePath)) {
    rawPayload = JSON.parse(fs.readFileSync(resultsFilePath, "utf-8"));
  }

  writeJson(path.join(outputDir, "raw-articles.json"), {
    resultsFilePath,
    ...rawPayload,
  });

  const articles = Array.isArray(rawPayload.articles)
    ? (rawPayload.articles as ScrapedArticleRow[])
    : [];
  const scrapeSummary = buildScrapeSummary(articles);
  writeJson(path.join(outputDir, "scrape-summary.json"), {
    resultsFilePath,
    attempted: scrapeSummary.length,
    succeeded: scrapeSummary.filter((row) => row.success).length,
    failed: scrapeSummary.filter((row) => !row.success).length,
    articles: scrapeSummary,
  });

  const normalizationPreview: NormalizationPreviewEntry[] = [];
  const normalizationEntries: NormalizationSummaryEntry[] = [];

  for (const article of articles) {
    const candidate = normalizeStoryCandidate(article, sourceKey);
    const validation = validateNormalizedCandidate(candidate);
    const bodyWordCount = countWords(candidate.body);

    normalizationPreview.push({
      url: candidate.sourceUrl,
      candidate,
      validation,
      bodyWordCount,
    });

    normalizationEntries.push({
      url: candidate.sourceUrl,
      valid: validation.valid,
      reasons: validation.reasons,
      bodyWordCount,
    });
  }

  const normalizationPassed = normalizationEntries.filter((entry) => entry.valid).length;
  const normalizationFailed = normalizationEntries.length - normalizationPassed;

  writeJson(path.join(outputDir, "normalized-preview.json"), normalizationPreview);
  writeJson(path.join(outputDir, "normalization-summary.json"), {
    total: normalizationEntries.length,
    passed: normalizationPassed,
    failed: normalizationFailed,
    entries: normalizationEntries,
  });

  const scrapedUrls = scrapeSummary.map((row) => row.url).filter(Boolean);
  let supabaseLookup: Record<string, unknown>;

  if (!hasSupabaseEnv()) {
    supabaseLookup = {
      enabled: false,
      reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      results: scrapedUrls.map((sourceUrl) => ({
        sourceUrl,
        existsInSupabase: false,
        status: null,
        candidateId: null,
      })),
    };
  } else {
    const lookup = await lookupStoryCandidatesBySourceUrls(scrapedUrls);
    const results = scrapedUrls.map((sourceUrl) => lookup[sourceUrl]);
    supabaseLookup = {
      enabled: true,
      results,
    };
  }

  writeJson(path.join(outputDir, "supabase-lookup.json"), supabaseLookup);

  const warnings: string[] = [];
  if (normMeta?.requiresLegalReview) {
    warnings.push("Source flagged for legal review (requiresLegalReview=true)");
  }

  for (const row of scrapeSummary) {
    if (!row.publishedAt) {
      warnings.push(`Missing publishedAt: ${row.url}`);
    }
    if (!row.success) {
      warnings.push(`Scrape failed: ${row.url}${row.error ? ` (${row.error})` : ""}`);
    }
  }

  for (const entry of normalizationEntries) {
    if (!entry.valid) {
      warnings.push(`Normalization failed for ${entry.url}: ${entry.reasons.join(", ")}`);
    }
  }

  const scrapeSucceeded = scrapeSummary.filter((row) => row.success).length;
  const scrapeRate = scrapeSummary.length > 0 ? scrapeSucceeded / scrapeSummary.length : 0;
  const normalizeRate =
    normalizationEntries.length > 0 ? normalizationPassed / normalizationEntries.length : 0;
  const healthVerdict =
    scrapeRate >= 0.8 && normalizeRate >= 0.8 ? "healthy" : "needs attention";

  const reportPath = path.join(outputDir, "INSPECTION_REPORT.md");
  fs.writeFileSync(
    reportPath,
    buildInspectionReport({
      command,
      sourceKey,
      limit,
      outputDir,
      resultsFilePath,
      metadata: sourceMetadata,
      discovery,
      scrapeSummary,
      normalizationSummary: {
        total: normalizationEntries.length,
        passed: normalizationPassed,
        failed: normalizationFailed,
        entries: normalizationEntries,
      },
      supabaseLookup,
      warnings,
      healthVerdict,
    }),
    "utf-8"
  );

  const supabaseExistsCount = supabaseLookup.enabled
    ? (supabaseLookup.results as Array<{ existsInSupabase?: boolean }>).filter(
        (row) => row.existsInSupabase
      ).length
    : null;

  console.log(`Scraped successfully: ${scrapeSucceeded}/${scrapeSummary.length}`);
  console.log(`Normalized successfully: ${normalizationPassed}/${normalizationEntries.length}`);
  if (supabaseLookup.enabled && supabaseExistsCount !== null) {
    console.log(`Already in Supabase: ${supabaseExistsCount}/${scrapedUrls.length}`);
  } else {
    console.log("Supabase lookup: skipped (env not configured)");
  }
  console.log(`Health: ${healthVerdict}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Inspection failed: ${message}`);
  process.exit(1);
});
