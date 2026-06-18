/**
 * One-off Fetcher Worker executor for run1/run2/run3/run4.
 *
 * Usage:
 *   npm run fetcher:run -- --run=run1
 *   npm run run:run1
 */
import { logger } from "../config/logger";
import { SCRAPING_RUNS, type RunConfig } from "../config/scrapingControl";
import { getFetcherRunIdFromEnv, getFetcherRunOptionsFromEnv } from "../fetcherWorker/config";
import { runFetcherBatch } from "../fetcherWorker/runFetcherBatch";

type RunId = RunConfig["id"];

function parseRunIdArg(): RunId | null {
  const arg = process.argv.find((entry) => entry.startsWith("--run="));
  if (!arg) return null;

  const runId = arg.replace("--run=", "") as RunId;
  return ["run1", "run2", "run3", "run4"].includes(runId) ? runId : null;
}

function resolveRunId(): RunId | null {
  const fromArg = parseRunIdArg();
  if (fromArg) return fromArg;

  const fromEnv = getFetcherRunIdFromEnv();
  if (!fromEnv) return null;

  const runId = fromEnv as RunId;
  return ["run1", "run2", "run3", "run4"].includes(runId) ? runId : null;
}

async function main(): Promise<void> {
  const runId = resolveRunId();
  if (!runId) {
    logger.error('❌ Missing run id. Use --run=run1 (or FETCHER_RUN_ID=run1).');
    process.exit(1);
  }

  const run = SCRAPING_RUNS.find((entry) => entry.id === runId);
  if (!run) {
    logger.error(`❌ Unknown runId: ${runId}`);
    process.exit(1);
  }

  if (!run.enabled) {
    logger.info(`⏸️  Run ${runId} is disabled in config. Exiting.`);
    process.exit(0);
  }

  const options = getFetcherRunOptionsFromEnv();
  const result = await runFetcherBatch(run, options);

  logger.info(`✅ Finished fetcher run ${run.id}`, {
    batchId: result.batchId,
    dryRun: result.dryRun,
    writeEnabled: result.writeEnabled,
    sourcesSelected: result.sourcesSelected.length,
    scrapedArticlesCount: result.scrapedArticlesCount,
    normalizedValidCount: result.normalizedValidCount,
    candidatesInserted: result.candidatesInserted,
    supabaseUpdated: result.supabaseUpdated,
  });
}

main().catch((error) => {
  logger.error("❌ runFetcherOnce failed:", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
