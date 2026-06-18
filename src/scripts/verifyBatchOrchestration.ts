/**
 * Batch orchestration verification (assert-only, safe).
 *
 * This script validates that batch-aware orchestration wiring exists and that
 * dry-run artifacts are emitted without OpenAI or Sanity writes.
 */

import * as fs from "fs";
import * as path from "path";
import { SCRAPING_RUNS } from "../config/scrapingControl";
import { runFetcherBatch } from "../fetcherWorker/runFetcherBatch";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFileContains(filePath: string, needle: string, label: string): void {
  const text = fs.readFileSync(filePath, "utf-8");
  assert(text.includes(needle), `${label} missing expected snippet: ${needle}`);
}

async function verifyFetcherDryRunBatchArtifact(): Promise<void> {
  const run = SCRAPING_RUNS.find((entry) => entry.id === "run1");
  assert(Boolean(run), "run1 not found in SCRAPING_RUNS");

  const result = await runFetcherBatch(run!, {
    dryRun: true,
    writeEnabled: false,
    sourceKeysFilter: null,
    maxTotalArticles: 2,
    workflowRunId: null,
  });

  assert(result.batchId.startsWith("dry-run-run1-"), "Expected dry-run batch id");
  assert(result.openAiCalled === false, "Fetcher should not call OpenAI");
  assert(result.sanityCalled === false, "Fetcher should not call Sanity");
  assert(fs.existsSync(result.reportPaths.latestBatchJson), "latest-batch.json should be created");

  const latest = JSON.parse(fs.readFileSync(result.reportPaths.latestBatchJson, "utf-8")) as {
    batchId: string;
    runId: string;
    insertedCount: number;
  };
  assert(latest.batchId === result.batchId, "latest-batch batchId mismatch");
  assert(latest.runId === "run1", "latest-batch runId mismatch");
  assert(typeof latest.insertedCount === "number", "latest-batch insertedCount must be numeric");
}

function verifyBatchAwareQueryFilters(): void {
  const storyCandidatesPath = path.join(
    process.cwd(),
    "src",
    "db",
    "storyCandidates.ts"
  );
  assertFileContains(
    storyCandidatesPath,
    'query = query.eq("ingestion_batch_id", batchId);',
    "DB batch filter"
  );
  assertFileContains(
    storyCandidatesPath,
    "export async function getBatchCandidateStatusCounts(",
    "Batch status counts helper"
  );
}

function verifyWorkerBatchModeWiring(): void {
  const aiScript = path.join(process.cwd(), "src", "scripts", "processPendingCandidates.ts");
  const gunnerScript = path.join(
    process.cwd(),
    "src",
    "scripts",
    "createSanityDraftsFromProcessed.ts"
  );

  assertFileContains(aiScript, "AI_BATCH_ID", "AI batch env support");
  assertFileContains(aiScript, "AI_EXPECTED_COUNT", "AI expected count env support");
  assertFileContains(aiScript, "AI_STRICT_BATCH_COUNTS", "AI strict env support");
  assertFileContains(aiScript, "remainingPendingInBatch", "AI remaining pending summary");
  assertFileContains(aiScript, "LATEST_BATCH_PATH", "AI latest-batch output");

  assertFileContains(gunnerScript, "GUNNER_BATCH_ID", "Gunner batch env support");
  assertFileContains(gunnerScript, "GUNNER_EXPECTED_COUNT", "Gunner expected count env support");
  assertFileContains(gunnerScript, "GUNNER_STRICT_BATCH_COUNTS", "Gunner strict env support");
  assertFileContains(gunnerScript, "remainingProcessedInBatch", "Gunner remaining processed summary");
  assertFileContains(gunnerScript, "LATEST_BATCH_PATH", "Gunner latest-batch output");
}

function verifyQueueModeFallback(): void {
  const storyCandidatesPath = path.join(
    process.cwd(),
    "src",
    "db",
    "storyCandidates.ts"
  );
  assertFileContains(
    storyCandidatesPath,
    "limit?: number | null,",
    "Optional limit signature for queue/batch compatibility"
  );
  assertFileContains(
    storyCandidatesPath,
    "batchId?: string | null",
    "Optional batchId signature for queue fallback"
  );
}

async function main(): Promise<void> {
  await verifyFetcherDryRunBatchArtifact();
  verifyBatchAwareQueryFilters();
  verifyWorkerBatchModeWiring();
  verifyQueueModeFallback();

  console.log("verifyBatchOrchestration: PASS");
  console.log(
    JSON.stringify(
      {
        batchIdGeneration: "ok",
        batchFilters: "ok",
        aiBatchMode: "ok",
        gunnerBatchMode: "ok",
        queueFallback: "ok",
        openAiCalled: false,
        sanityCalled: false,
        publishingPerformed: false,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`verifyBatchOrchestration: FAIL - ${message}`);
  process.exit(1);
});
