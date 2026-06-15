/**
 * Scraping-only audit: runs each configured source, validates JSON output,
 * writes audit-output/scraping/ reports. No OpenAI, Sanity, or Supabase.
 */

import * as fs from "fs";
import * as path from "path";
import { runSourceScraper, readScrapedArticles } from "../core/scrapingRunner";
import { logger } from "../config/logger";
import { parseSourceKeysEnv } from "../config/sourceKeyFilters";
import { getLatestResultFilePath } from "../utils/scraperUtils";
import {
  AUDIT_SOURCE_MANIFEST,
  type AuditSourceManifestEntry,
  type ReadinessStatus,
} from "./auditScrapeManifest";
import {
  auditSourceArticles,
  sanitizeArticle,
  type ScrapedArticleRow,
  type SourceAuditResult,
} from "./auditScrapeValidate";

process.env.CHATGPT_MIDDLEWARE_ENABLED = "false";
process.env.SANITY_GUNNER_ENABLED = "false";

const AUDIT_COMMAND =
  "CHATGPT_MIDDLEWARE_ENABLED=false SANITY_GUNNER_ENABLED=false npm run audit:scrape";

/** Baseline from audit before Step 1 scraper fixes (2026-06-13). */
const AUDIT_BASELINE = {
  auditedAt: "2026-06-13T21:29:57.392Z",
  readyCount: 2,
  needsMinorFixesCount: 14,
  needsMajorFixesCount: 7,
  disableForMvpCount: 0,
  brokenSources: [
    "yahooUSNews",
    "yahooWorldNews",
    "yahooPoliticsNews",
    "abcNewsUS",
    "abcNewsInternational",
    "abcNewsBusiness",
    "abcNewsTechnology",
  ],
  fixesApplied: [
    "Yahoo US/World/Politics: accept /news/{section}/articles/ URL pattern via shared discoverYahooNewsSectionArticles",
    "ABC: migrate from abcnews.go.com regex to abcnews.com HTML link discovery (shared abcNewsShared.ts)",
    "publishedAt: shared extractPublishedAt (JSON-LD → meta → time) on all detail scrapers",
    "Body cleanup: cleanArticleBody applied at scrape time; CBS In:/footer patterns extended",
    "Article shape: sourceKey, source, publishedAt, scrapedAt via buildScrapedArticle helpers",
  ],
  filesChanged: [
    "src/utils/extractPublishedAt.ts",
    "src/utils/yahooDiscovery.ts",
    "src/sources/abcNewsShared.ts",
    "src/utils/buildScrapedArticle.ts",
    "src/sources/yahooNewsScraper.ts",
    "src/sources/abcNews*Scraper.ts (×4)",
    "src/sources/apNewsScraper.ts",
    "src/sources/cbs*Scraper.ts (×3)",
    "src/sources/techCrunchScraper.ts",
    "src/middleware/cleaningPatterns.ts",
    "src/scrapers/**/*.ts (×23)",
    "src/scripts/auditScrapeManifest.ts",
    "src/scripts/auditScrape.ts",
  ],
};

function parseArticleLimit(): number {
  const raw = parseInt(process.env.AUDIT_ARTICLE_LIMIT || "3", 10);
  if (!Number.isFinite(raw)) return 3;
  return Math.min(5, Math.max(2, raw));
}

function parseSourceDelayMs(): number {
  const raw = parseInt(process.env.AUDIT_SOURCE_DELAY_MS || "2000", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
}

function parseAuditSources(): AuditSourceManifestEntry[] {
  const selected = parseSourceKeysEnv(process.env.AUDIT_SOURCE_KEYS, "AUDIT_SOURCE_KEYS");
  if (!selected) {
    return AUDIT_SOURCE_MANIFEST;
  }

  return AUDIT_SOURCE_MANIFEST.filter((entry) => selected.has(entry.sourceKey));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRawMetadata(rawPath: string | null): {
  discovered: number;
  metadata: Record<string, unknown> | null;
} {
  if (!rawPath || !fs.existsSync(rawPath)) {
    return { discovered: 0, metadata: null };
  }
  try {
    const data = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
    const discovered =
      typeof data.metadata?.totalHomepageItems === "number"
        ? data.metadata.totalHomepageItems
        : Array.isArray(data.homepageItems)
          ? data.homepageItems.length
          : 0;
    return { discovered, metadata: data.metadata || null };
  } catch {
    return { discovered: 0, metadata: null };
  }
}

function buildMarkdownReport(
  results: Array<
    SourceAuditResult & {
      displayName: string;
      sectionUrl: string;
      wrapperPath: string;
      sourcePath: string;
      extractionMethod: string;
      auditOutputPath: string;
      rawResultPath: string | null;
    }
  >,
  summary: Record<string, unknown>
): string {
  const lines: string[] = [
    "# Scraping Audit Report",
    "",
    `Generated: ${summary.auditedAt}`,
    `Command: \`${summary.command}\``,
    `Article limit per source: ${summary.articleLimit}`,
    "",
    "## Executive summary",
    "",
    `- Sources tested: ${summary.totalSources}`,
    `- Ready: ${summary.readyCount}`,
    `- Needs minor fixes: ${summary.needsMinorFixesCount}`,
    `- Needs major fixes: ${summary.needsMajorFixesCount}`,
    `- Disable for MVP: ${summary.disableForMvpCount}`,
    `- Step 1 ready for Supabase: **${summary.step1Ready ? "YES (partial)" : "NO"}**`,
    "",
    "## Before / After (Step 1 scraper fixes)",
    "",
    `Prior audit: ${AUDIT_BASELINE.auditedAt}`,
    "",
    "| Metric | Before | After |",
    "|--------|--------|-------|",
    `| Ready | ${AUDIT_BASELINE.readyCount} | ${summary.readyCount} |`,
    `| Needs minor fixes | ${AUDIT_BASELINE.needsMinorFixesCount} | ${summary.needsMinorFixesCount} |`,
    `| Needs major fixes | ${AUDIT_BASELINE.needsMajorFixesCount} | ${summary.needsMajorFixesCount} |`,
    `| Disable for MVP | ${AUDIT_BASELINE.disableForMvpCount} | ${summary.disableForMvpCount} |`,
    "",
    "### Sources fixed",
    "",
    ...AUDIT_BASELINE.brokenSources.map((s) => {
      const after = (results as Array<{ sourceKey: string; discovered: number; succeeded: number; readiness: string }>).find(
        (r) => r.sourceKey === s
      );
      const status = after
        ? `${after.discovered} discovered, ${after.succeeded} succeeded, **${after.readiness}**`
        : "not re-tested";
      return `- \`${s}\`: ${status}`;
    }),
    "",
    "### Files changed",
    "",
    ...AUDIT_BASELINE.filesChanged.map((f) => `- \`${f}\``),
    "",
    "### Extraction strategy updates",
    "",
    ...AUDIT_BASELINE.fixesApplied.map((f) => `- ${f}`),
    "",
    "### Per-source discovery (after)",
    "",
    "| Source | Discovered | Succeeded | Readiness |",
    "|--------|------------|-----------|-----------|",
    ...(results as Array<{ sourceKey: string; discovered: number; succeeded: number; readiness: string }>).map(
      (r) => `| \`${r.sourceKey}\` | ${r.discovered} | ${r.succeeded} | ${r.readiness} |`
    ),
    "",
    "## MVP recommendations",
    "",
    "### Enable for first MVP",
    ...(summary.mvpEnableList as string[]).map((s) => `- ${s}`),
    ...(summary.mvpEnableList as string[]).length === 0 ? ["- (none passed audit)"] : [],
    "",
    "### Disable or defer",
    ...(summary.mvpDisableList as string[]).map((s) => `- ${s}`),
    "",
    "### Supabase field normalization (Step 1)",
    "",
    "Map scraped JSON to: `source_key`, `source_url` (from `url`), `title`, `excerpt`, `body`, `category`, `scraped_at`, `raw_payload`, `success`, `error`.",
    "",
    "### RSS/API candidates",
    "",
    "All current sources use HTML scraping only. Consider official RSS/API feeds for AP, Yahoo, and CBS before production scale.",
    "",
    "---",
    "",
  ];

  for (const r of results) {
    const pct = Math.round(r.successRate * 100);
    lines.push(`## ${r.displayName} (\`${r.sourceKey}\`)`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Readiness | **${r.readiness}** |`);
    lines.push(`| Wrapper | \`${r.wrapperPath}\` |`);
    lines.push(`| Source impl | \`${r.sourcePath}\` |`);
    lines.push(`| Section URL | ${r.sectionUrl} |`);
    lines.push(`| Extraction | ${r.extractionMethod} |`);
    lines.push(`| Discovered URLs | ${r.discovered} |`);
    lines.push(`| Attempted | ${r.attempted} |`);
    lines.push(`| Succeeded | ${r.succeeded} |`);
    lines.push(`| Failed | ${r.failed} |`);
    lines.push(`| Success rate | ${pct}% |`);
    lines.push(
      `| Body length range | ${r.bodyLengthRange ? `${r.bodyLengthRange.min}–${r.bodyLengthRange.max} chars (median ${Math.round(r.bodyLengthRange.median)})` : "n/a"} |`
    );
    lines.push(
      `| Body word median | ${r.bodyWordMedian ?? "n/a"} |`
    );
    lines.push(`| Example title | ${r.exampleSuccessTitle ?? "(none)"} |`);
    lines.push(`| Output JSON | \`${r.auditOutputPath}\` |`);
    lines.push(`| Raw results | \`${r.rawResultPath ?? "n/a"}\` |`);
    lines.push("");

    if (r.errors.length > 0) {
      lines.push("**Errors:**");
      for (const e of r.errors) lines.push(`- ${e}`);
      lines.push("");
    }

    if (r.validationIssues.length > 0) {
      lines.push("**Validation issues:**");
      for (const v of r.validationIssues) lines.push(`- ${v}`);
      lines.push("");
    }

    if (r.recommendedFixes.length > 0) {
      lines.push("**Recommended fixes:**");
      for (const f of r.recommendedFixes) lines.push(`- ${f}`);
      lines.push("");
    }

    lines.push(`**Ready for Supabase ingestion:** ${r.readiness === "ready" || r.readiness === "needs minor fixes" ? "Yes (with noted fixes)" : "No"}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const articleLimit = parseArticleLimit();
  const sourceDelayMs = parseSourceDelayMs();
  const sourcesToAudit = parseAuditSources();
  const auditedAt = new Date().toISOString();
  const outputDir = path.join(process.cwd(), "audit-output", "scraping");

  fs.mkdirSync(outputDir, { recursive: true });

  logger.info("Starting scraping-only audit");
  logger.info(`Article limit: ${articleLimit}, source delay: ${sourceDelayMs}ms`);
  logger.info(`Sources selected: ${sourcesToAudit.length}`);
  logger.info(`CHATGPT_MIDDLEWARE_ENABLED=${process.env.CHATGPT_MIDDLEWARE_ENABLED}`);
  logger.info(`SANITY_GUNNER_ENABLED=${process.env.SANITY_GUNNER_ENABLED}`);

  const sourceResults: Array<
    SourceAuditResult & {
      displayName: string;
      sectionUrl: string;
      wrapperPath: string;
      sourcePath: string;
      extractionMethod: string;
      auditOutputPath: string;
      rawResultPath: string | null;
      command: string;
      articleLimit: number;
      auditedAt: string;
      articles: ScrapedArticleRow[];
    }
  > = [];

  for (let i = 0; i < sourcesToAudit.length; i++) {
    const entry = sourcesToAudit[i];
    logger.info(
      `[${i + 1}/${sourcesToAudit.length}] Scraping ${entry.sourceKey} (${entry.displayName})`
    );

    const scrapeErrors: string[] = [];
    let articles: ScrapedArticleRow[] = [];

    try {
      await runSourceScraper(entry.sourceKey, articleLimit, {
        skipEnabledCheck: true,
      });
      articles = readScrapedArticles(entry.sourceKey) as ScrapedArticleRow[];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      scrapeErrors.push(msg);
      logger.error(`Scrape failed for ${entry.sourceKey}:`, { error: msg });
    }

    const rawResultPath = getLatestResultFilePath(entry.sourceKey);
    const { discovered } = loadRawMetadata(rawResultPath);

    const audit = auditSourceArticles(
      entry.sourceKey,
      articles,
      discovered || articles.length,
      scrapeErrors,
      entry.tosRisk
    );

    const auditOutputPath = path.join(outputDir, `${entry.sourceKey}.json`);
    const payload = {
      sourceKey: entry.sourceKey,
      displayName: entry.displayName,
      auditedAt,
      command: AUDIT_COMMAND,
      sectionUrl: entry.sectionUrl,
      wrapperPath: entry.wrapperPath,
      sourcePath: entry.sourcePath,
      extractionMethod: entry.extractionMethod,
      articleLimit,
      discovered: audit.discovered,
      attempted: audit.attempted,
      succeeded: audit.succeeded,
      failed: audit.failed,
      successRate: audit.successRate,
      bodyLengthRange: audit.bodyLengthRange,
      bodyWordMedian: audit.bodyWordMedian,
      duplicateUrlCount: audit.duplicateUrlCount,
      validationIssues: audit.validationIssues,
      articleValidations: audit.articleValidations,
      errors: audit.errors,
      readiness: audit.readiness,
      recommendedFixes: audit.recommendedFixes,
      exampleSuccessTitle: audit.exampleSuccessTitle,
      rawResultPath: rawResultPath
        ? path.relative(process.cwd(), rawResultPath)
        : null,
      articles: articles.map(sanitizeArticle),
    };

    fs.writeFileSync(auditOutputPath, JSON.stringify(payload, null, 2), "utf-8");

    sourceResults.push({
      ...audit,
      displayName: entry.displayName,
      sectionUrl: entry.sectionUrl,
      wrapperPath: entry.wrapperPath,
      sourcePath: entry.sourcePath,
      extractionMethod: entry.extractionMethod,
      auditOutputPath: path.relative(process.cwd(), auditOutputPath),
      rawResultPath: rawResultPath
        ? path.relative(process.cwd(), rawResultPath)
        : null,
      command: AUDIT_COMMAND,
      articleLimit,
      auditedAt,
      articles: articles.map(sanitizeArticle),
    });

    logger.info(
      `${entry.sourceKey}: ${audit.succeeded}/${audit.attempted} ok, readiness=${audit.readiness}`
    );

    if (i < sourcesToAudit.length - 1 && sourceDelayMs > 0) {
      await sleep(sourceDelayMs);
    }
  }

  const readinessCounts: Record<ReadinessStatus, number> = {
    ready: 0,
    "needs minor fixes": 0,
    "needs major fixes": 0,
    "disable for MVP": 0,
  };

  for (const r of sourceResults) {
    readinessCounts[r.readiness]++;
  }

  const mvpEnableList = sourceResults
    .filter((r) => r.readiness === "ready")
    .map((r) => `${r.displayName} (${r.sourceKey})`);

  const mvpMinorList = sourceResults
    .filter((r) => r.readiness === "needs minor fixes")
    .map((r) => `${r.displayName} (${r.sourceKey})`);

  const mvpDisableList = sourceResults
    .filter(
      (r) =>
        r.readiness === "disable for MVP" || r.readiness === "needs major fixes"
    )
    .map((r) => `${r.displayName} (${r.sourceKey}) — ${r.readiness}`);

  const step1Ready =
    readinessCounts.ready >= 3 ||
    readinessCounts.ready + readinessCounts["needs minor fixes"] >= 5;

  const summary = {
    auditedAt,
    command: AUDIT_COMMAND,
    articleLimit,
    sourceDelayMs,
    totalSources: sourceResults.length,
    readyCount: readinessCounts.ready,
    needsMinorFixesCount: readinessCounts["needs minor fixes"],
    needsMajorFixesCount: readinessCounts["needs major fixes"],
    disableForMvpCount: readinessCounts["disable for MVP"],
    step1Ready,
    mvpEnableList,
    mvpMinorEnableList: mvpMinorList,
    mvpDisableList,
    sources: sourceResults.map((r) => ({
      sourceKey: r.sourceKey,
      displayName: r.displayName,
      readiness: r.readiness,
      successRate: r.successRate,
      discovered: r.discovered,
      succeeded: r.succeeded,
      attempted: r.attempted,
      auditOutputPath: r.auditOutputPath,
    })),
  };

  const summaryPath = path.join(outputDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  const reportPath = path.join(outputDir, "SCRAPING_AUDIT.md");
  fs.writeFileSync(
    reportPath,
    buildMarkdownReport(sourceResults, summary),
    "utf-8"
  );

  console.log("\n" + "=".repeat(60));
  console.log("Scraping audit complete");
  console.log("=".repeat(60));
  console.log(`Summary: ${path.relative(process.cwd(), summaryPath)}`);
  console.log(`Report:  ${path.relative(process.cwd(), reportPath)}`);
  console.log(`Ready: ${readinessCounts.ready} | Minor fixes: ${readinessCounts["needs minor fixes"]} | Major: ${readinessCounts["needs major fixes"]} | Disable: ${readinessCounts["disable for MVP"]}`);
  console.log(`Step 1 Supabase ready: ${step1Ready ? "YES (partial)" : "NO"}`);
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  logger.error("Audit failed:", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
