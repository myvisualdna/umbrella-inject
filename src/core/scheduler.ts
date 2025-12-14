/**
 * Scheduler that runs scraping jobs on a schedule
 * Each run is configured in SCRAPING_RUNS and executes automatically
 * 
 * For GitHub Actions, use runOnce.ts instead (npm run run:run1, etc.)
 * For local testing, use npm run run:run1, etc.
 */
import cron from "node-cron";
import { logger } from "../config/logger";
import { executeRunById } from "./scrapingRunner";
import { SCRAPING_RUNS } from "../config/scrapingControl";

function startScheduler(): void {
  logger.info("⏰ Initializing cron scheduler...");

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
          await executeRunById(run.id);
        } catch (error) {
          logger.error(`❌ Failed to execute run ${run.id}:`, {
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
  logger.info(`🎯 Cron scheduler started - Enabled runs: ${runIds || "none"}`);
  logger.info(`📅 Schedule: ${cronExpression}`);
  logger.info("💤 Process will run in background, waiting for scheduled times...");
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
