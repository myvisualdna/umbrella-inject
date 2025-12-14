/**
 * One-off run executor for GitHub Actions
 * 
 * Executes a single run and exits (perfect for scheduled workflows)
 * Usage: npm run run:run1 (which calls: ts-node src/core/runOnce.ts --run=run1)
 */

import { logger } from "../config/logger";
import { executeRunById } from "./scrapingRunner";
import { SCRAPING_RUNS } from "../config/scrapingControl";

type RunId = "run1" | "run2" | "run3" | "run4";

function parseRunId(): RunId | null {
  const arg = process.argv.find((a) => a.startsWith("--run="));
  if (!arg) return null;

  const runId = arg.replace("--run=", "") as RunId;
  return ["run1", "run2", "run3", "run4"].includes(runId) ? runId : null;
}

async function main() {
  const runId = parseRunId();

  if (!runId) {
    logger.error('❌ Missing --run argument. Example: "npm run run:run1"');
    process.exit(1);
  }

  const run = SCRAPING_RUNS.find((r) => r.id === runId);
  if (!run) {
    logger.error(`❌ Unknown runId: ${runId}`);
    process.exit(1);
  }

  if (!run.enabled) {
    logger.info(`⏸️  Run ${runId} is disabled in config. Exiting.`);
    process.exit(0);
  }

  logger.info(`🚀 Executing ${runId} (${run.label}) as one-off job...`);
  await executeRunById(runId);
  logger.info(`✅ Finished ${runId}`);
}

main().catch((error) => {
  logger.error("❌ runOnce failed:", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
