import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import type { RunConfig, SourceKey } from "../config/scrapingControl";
import { isScraperEnabled } from "../config/scraperSwitches";
import { getExistingSourceUrls, insertStoryCandidates, validateForInsert } from "../db/storyCandidates";
import {
  createStoryCandidateBatch,
  markStoryCandidateBatchFailed,
  markStoryCandidateBatchFetched,
} from "../db/storyCandidateBatches";
import { hasSupabaseEnv } from "../db/supabaseClient";
import { runSourceScraper } from "../core/scraperDispatch";
import { canonicalizeUrl, normalizeStoryCandidate } from "../normalization/normalizeStoryCandidate";
import type { NormalizedStoryCandidate, RawScrapedArticle } from "../normalization/types";
import { getLatestArticlesFromSource } from "../utils/scraperUtils";
import { notifyFetcherRunComplete, notifyStageFailure } from "../slack/pipelineNotify";
import type {
  FetcherRejectedCandidate,
  FetcherRunOptions,
  FetcherRunResult,
  FetcherSourceSelection,
} from "./types";

const FETCHER_AUDIT_DIR = path.join(process.cwd(), "audit-output", "fetcher-worker");
const FETCHER_SUMMARY_PATH = path.join(FETCHER_AUDIT_DIR, "summary.json");
const FETCHER_REPORT_PATH = path.join(FETCHER_AUDIT_DIR, "FETCHER_WORKER_AUDIT.md");
const FETCHER_LATEST_BATCH_PATH = path.join(FETCHER_AUDIT_DIR, "latest-batch.json");

function ensureAuditDir(): void {
  if (!fs.existsSync(FETCHER_AUDIT_DIR)) {
    fs.mkdirSync(FETCHER_AUDIT_DIR, { recursive: true });
  }
}

function truncateArticles(
  articles: RawScrapedArticle[],
  maxTotalArticles: number | null
): RawScrapedArticle[] {
  if (!maxTotalArticles || articles.length <= maxTotalArticles) {
    return articles;
  }
  return articles.slice(0, maxTotalArticles);
}

function buildSelectedSources(
  run: RunConfig,
  sourceKeysFilter: Set<SourceKey> | null
): FetcherSourceSelection[] {
  return run.sources.filter(({ source, count }) => {
    if (count <= 0) return false;
    if (!isScraperEnabled(source)) return false;
    if (sourceKeysFilter && !sourceKeysFilter.has(source)) return false;
    return true;
  });
}

function makeDryRunBatchId(run: RunConfig): string {
  const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
  return `dry-run-${run.id}-${safeTs}`;
}

function writeAuditReport(result: FetcherRunResult): void {
  ensureAuditDir();

  fs.writeFileSync(FETCHER_SUMMARY_PATH, JSON.stringify(result, null, 2), "utf-8");
  fs.writeFileSync(
    FETCHER_LATEST_BATCH_PATH,
    `${JSON.stringify(
      {
        batchId: result.batchId,
        runId: result.runId,
        insertedCount: result.insertedCount,
        normalizedValidCount: result.normalizedValidCount,
        duplicateCount: result.duplicateCount,
        supabaseUpdated: result.supabaseUpdated,
      },
      null,
      2
    )}\n`,
    "utf-8"
  );

  const lines: string[] = [];
  lines.push("# Fetcher Worker Audit");
  lines.push("");
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Run: ${result.runId} (${result.runLabel})`);
  lines.push(`- Batch ID: ${result.batchId}`);
  lines.push(`- Dry run: ${result.dryRun}`);
  lines.push(`- Write enabled: ${result.writeEnabled}`);
  lines.push(`- Sources selected: ${result.sourcesSelected.length}`);
  lines.push(`- Planned total articles: ${result.plannedTotalArticles}`);
  lines.push(`- Scraped articles: ${result.scrapedArticlesCount}`);
  lines.push(`- Normalized valid candidates: ${result.normalizedValidCount}`);
  lines.push(`- Rejected candidates: ${result.rejectedCount}`);
  lines.push(`- Duplicate candidates: ${result.duplicateCount}`);
  lines.push(`- Candidates inserted: ${result.candidatesInserted}`);
  lines.push(`- Supabase updated: ${result.supabaseUpdated}`);
  lines.push(`- openAiCalled: ${result.openAiCalled}`);
  lines.push(`- sanityCalled: ${result.sanityCalled}`);
  lines.push("");
  lines.push("## Selected Sources");
  for (const source of result.sourcesSelected) {
    lines.push(`- ${source.source}: ${source.count}`);
  }
  lines.push("");
  lines.push("## Rejected Candidates");
  if (result.rejectedCandidates.length === 0) {
    lines.push("- none");
  } else {
    for (const rejected of result.rejectedCandidates) {
      lines.push(
        `- ${rejected.sourceKey} | ${rejected.sourceUrl} | ${rejected.reasons.join("; ")}`
      );
    }
  }

  fs.writeFileSync(FETCHER_REPORT_PATH, `${lines.join("\n")}\n`, "utf-8");
}

export async function runFetcherBatch(
  run: RunConfig,
  options: FetcherRunOptions
): Promise<FetcherRunResult> {
  let batchId = makeDryRunBatchId(run);
  const writeMode = !options.dryRun && options.writeEnabled;
  if (writeMode) {
    const created = await createStoryCandidateBatch({
      runId: run.id,
      runLabel: run.label,
      workflowRunId: options.workflowRunId,
      metadata: {
        sourceKeysFilter: options.sourceKeysFilter ? Array.from(options.sourceKeysFilter) : null,
        maxTotalArticles: options.maxTotalArticles,
      },
    });
    batchId = created.id;
  }

  const selectedSources = buildSelectedSources(run, options.sourceKeysFilter);
  const plannedTotalArticles = selectedSources.reduce((sum, item) => sum + item.count, 0);

  logger.info(`🚚 Fetcher Worker run starting: ${run.id} (${run.label})`, {
    dryRun: options.dryRun,
    writeEnabled: options.writeEnabled,
    selectedSources: selectedSources.length,
    plannedTotalArticles,
  });

  for (const source of selectedSources) {
    await runSourceScraper(source.source, source.count);
  }

  const rawArticles: RawScrapedArticle[] = [];
  for (const source of selectedSources) {
    const articles = getLatestArticlesFromSource(source.source);
    for (const article of articles) {
      rawArticles.push({
        ...(article as RawScrapedArticle),
        sourceKey: source.source,
      });
    }
  }

  const boundedRawArticles = truncateArticles(rawArticles, options.maxTotalArticles);
  const seenCanonicalUrls = new Set<string>();
  const normalizedValidCandidates: NormalizedStoryCandidate[] = [];
  const rejectedCandidates: FetcherRejectedCandidate[] = [];

  for (const article of boundedRawArticles) {
    const fallbackSource = String(article.sourceKey ?? article.source ?? "").trim();
    const normalized = normalizeStoryCandidate(article, fallbackSource || undefined);
    const canonicalUrl = canonicalizeUrl(normalized.sourceUrl);

    if (!canonicalUrl) {
      rejectedCandidates.push({
        sourceKey: normalized.sourceKey,
        sourceUrl: normalized.sourceUrl,
        reasons: ["missing sourceUrl"],
      });
      continue;
    }

    if (seenCanonicalUrls.has(canonicalUrl)) {
      rejectedCandidates.push({
        sourceKey: normalized.sourceKey,
        sourceUrl: normalized.sourceUrl,
        reasons: ["duplicate canonical URL in current run batch"],
      });
      continue;
    }
    seenCanonicalUrls.add(canonicalUrl);

    const validation = validateForInsert(normalized);
    if (!validation.valid) {
      rejectedCandidates.push({
        sourceKey: normalized.sourceKey,
        sourceUrl: normalized.sourceUrl,
        reasons: validation.reasons,
      });
      continue;
    }

    normalizedValidCandidates.push(normalized);
  }

  let duplicateCount = 0;
  let candidatesInserted = 0;
  let supabaseUpdated = false;

  try {
    if (writeMode) {
      const insertResult = await insertStoryCandidates(normalizedValidCandidates, {
        ingestionBatchId: batchId,
        ingestionRunId: run.id,
      });
      duplicateCount = insertResult.duplicateCount;
      candidatesInserted = insertResult.insertedCount;
      supabaseUpdated = candidatesInserted > 0;
      await markStoryCandidateBatchFetched(batchId, {
        scrapedCount: boundedRawArticles.length,
        normalizedValidCount: normalizedValidCandidates.length,
        insertedCount: candidatesInserted,
        duplicateCount,
        rejectedCount: rejectedCandidates.length,
      });
    } else if (hasSupabaseEnv()) {
      const existing = await getExistingSourceUrls(
        normalizedValidCandidates.map((candidate) => candidate.sourceUrl)
      );
      duplicateCount = existing.size;
    }
  } catch (error) {
    if (writeMode) {
      const message = error instanceof Error ? error.message : String(error);
      await markStoryCandidateBatchFailed(batchId, message);
    }
    await notifyStageFailure({
      stage: "fetcher",
      runId: run.id,
      batchId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const result: FetcherRunResult = {
    batchId,
    runId: run.id,
    runLabel: run.label,
    dryRun: options.dryRun,
    writeEnabled: options.writeEnabled,
    sourcesSelected: selectedSources,
    plannedTotalArticles,
    scrapedArticlesCount: boundedRawArticles.length,
    normalizedValidCount: normalizedValidCandidates.length,
    rejectedCount: rejectedCandidates.length,
    duplicateCount,
    candidatesInserted,
    scrapedCount: boundedRawArticles.length,
    insertedCount: candidatesInserted,
    supabaseUpdated,
    openAiCalled: false,
    sanityCalled: false,
    reportPaths: {
      summaryJson: FETCHER_SUMMARY_PATH,
      markdownAudit: FETCHER_REPORT_PATH,
      latestBatchJson: FETCHER_LATEST_BATCH_PATH,
    },
    normalizedValidCandidates,
    rejectedCandidates,
  };

  writeAuditReport(result);
  await notifyFetcherRunComplete(result);
  logger.info(`✅ Fetcher Worker run finished: ${run.id}`, {
    scrapedArticles: result.scrapedArticlesCount,
    normalizedValid: result.normalizedValidCount,
    rejected: result.rejectedCount,
    inserted: result.candidatesInserted,
    duplicateCount: result.duplicateCount,
    supabaseUpdated: result.supabaseUpdated,
  });

  return result;
}
