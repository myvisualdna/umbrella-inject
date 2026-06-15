/**
 * Legacy scheduler for the direct-to-Sanity pipeline.
 *
 * Guarded by ALLOW_LEGACY_DIRECT_SANITY=true.
 * This file is kept only for migration/rollback safety.
 */
import cron from "node-cron";
import { logger } from "../config/logger";
import { executeRunById } from "./scrapingRunner";
import { SCRAPING_RUNS } from "../config/scrapingControl";

function assertLegacyDirectSanityAllowed(): void {
  if (process.env.ALLOW_LEGACY_DIRECT_SANITY === "true") {
    return;
  }
  logger.error(
    "Legacy direct-to-Sanity scheduler is disabled. Set ALLOW_LEGACY_DIRECT_SANITY=true to enable."
  );
  process.exit(1);
}

function startScheduler(): void {
  assertLegacyDirectSanityAllowed();
  logger.info("⏰ Initializing legacy cron scheduler...");

  const cronExpression = process.env.CRON_SCHEDULE || "*/10 * * * *";

  for (const run of SCRAPING_RUNS) {
    if (!run.enabled) {
      logger.info(`⏸️  Skipping ${run.id} (${run.label}) - Run is disabled`);
      continue;
    }

    cron.schedule(cronExpression, async () => {
      try {
        await executeRunById(run.id);
      } catch (error) {
        logger.error(`❌ Failed to execute legacy run ${run.id}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    });

    logger.info(`✅ Scheduled legacy ${run.id} (${run.label}) - Cron: ${cronExpression}`);
  }

  const enabledRuns = SCRAPING_RUNS.filter((r) => r.enabled);
  const runIds = enabledRuns.map((r) => r.id).join(", ");
  logger.info(`🎯 Legacy cron scheduler started - Enabled runs: ${runIds || "none"}`);
  logger.info(`📅 Schedule: ${cronExpression}`);
}

startScheduler();
process.stdin.resume();

process.on("SIGINT", () => {
  logger.info("🛑 Received SIGINT, shutting down legacy scheduler...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Received SIGTERM, shutting down legacy scheduler...");
  process.exit(0);
});
