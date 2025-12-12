import cron from "node-cron";
import { logger } from "../config/logger";
import { executeRunById } from "./scrapingRunner";
import { SCRAPING_RUNS, isRunEnabled } from "../config/scrapingControl";

/**
 * Scheduler that runs scraping jobs at scheduled times in Eastern Time
 * Each run is configured in SCRAPING_RUNS and executes automatically
 */
function startScheduler(): void {
  logger.info("⏰ Initializing cron scheduler...");

  // Schedule each run from SCRAPING_RUNS
  // Using America/New_York timezone so times are always in Eastern Time
  // regardless of where the server is physically hosted

  for (const run of SCRAPING_RUNS) {
    // Skip disabled runs
    if (!run.enabled) {
      logger.info(`⏸️  Skipping ${run.id} (${run.label}) - Run is disabled`);
      continue;
    }

    // Parse timeET (e.g., "07:00") to get hours and minutes
    const [hours, minutes] = run.timeET.split(":").map(Number);

    // Validate time format
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      logger.error(`❌ Invalid time format for ${run.id}: ${run.timeET}. Expected format: "HH:MM"`);
      continue;
    }

    // Create cron expression: "minutes hours * * *" (runs daily at specified time)
    // const cronExpression = `${minutes} ${hours} * * *`;
    // TESTING MODE: Run immediately, then every 2 minutes
// TODO: Change back to production: const cronExpression = `${minutes} ${hours} * * *`;
const cronExpression = "*/2 * * * *"; // Every 2 minutes

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
      },
      {
        timezone: "America/New_York",
      }
    );

    logger.info(
      `✅ Scheduled ${run.id} (${run.label}) - Daily at ${run.timeET} ET`
    );
  }

  const enabledRuns = SCRAPING_RUNS.filter((r) => r.enabled);
  const runTimes = enabledRuns.map((r) => `${r.id} at ${r.timeET}`).join(", ");
  logger.info(`🎯 Cron scheduler started - Enabled runs: ${runTimes || "none"}`);
  logger.info("💤 Process will run in background, waiting for scheduled times...");
}

// Start the scheduler
startScheduler();

// Keep process alive
// This ensures the Node.js process doesn't exit, allowing cron jobs to run
process.stdin.resume();

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

