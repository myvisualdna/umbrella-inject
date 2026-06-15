/**
 * Fetcher scheduler for local/dev usage.
 *
 * This scheduler runs the Fetcher Worker path only:
 *   scrape -> normalize -> Supabase pending (or dry-run)
 *
 * It never calls legacy middleware or legacy gunner.
 */
import cron from "node-cron";
import { logger } from "../config/logger";
import { getFetcherRunOptionsFromEnv } from "../fetcherWorker/config";
import { runFetcherBatch } from "../fetcherWorker/runFetcherBatch";
import { SCRAPING_RUNS } from "../config/scrapingControl";

function startScheduler(): void {
  logger.info("⏰ Initializing fetcher cron scheduler...");

  // Default: run every 10 minutes (test mode)
  // Can be overridden with CRON_SCHEDULE environment variable
  const cronExpression = process.env.CRON_SCHEDULE || "*/10 * * * *";

  for (const run of SCRAPING_RUNS) {
    if (!run.enabled) {
      logger.info(`⏸️  Skipping ${run.id} (${run.label}) - Run is disabled`);
      continue;
    }

    cron.schedule(
      cronExpression,
      async () => {
        try {
          const options = getFetcherRunOptionsFromEnv();
          await runFetcherBatch(run, options);
        } catch (error) {
          logger.error(`❌ Failed to execute fetcher run ${run.id}:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    );

    logger.info(
      `✅ Scheduled ${run.id} (${run.label}) - Cron: ${cronExpression}`
    );
  }

  const enabledRuns = SCRAPING_RUNS.filter((r) => r.enabled);
  const runIds = enabledRuns.map((r) => r.id).join(", ");
  logger.info(`🎯 Fetcher cron scheduler started - Enabled runs: ${runIds || "none"}`);
  logger.info(`📅 Schedule: ${cronExpression}`);
  logger.info("💤 Fetcher process will run in background, waiting for scheduled times...");
}

startScheduler();

// Keep process alive (only relevant when running scheduler.ts)
process.stdin.resume();

process.on("SIGINT", () => {
  logger.info("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});
