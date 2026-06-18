import * as path from "path";
import {
  emitGithubOutputsFromArtifact,
  parseAllowMissing,
} from "./githubOutputUtils";

const ARTIFACT_PATH = path.join(process.cwd(), "audit-output", "ai-worker", "latest-batch.json");

function main(): void {
  emitGithubOutputsFromArtifact({
    allowMissing: parseAllowMissing(process.argv.slice(2)),
    stageLabel: "AI",
    artifactPath: ARTIFACT_PATH,
    requiredFields: [
      "batchId",
      "processedCount",
      "failedCount",
      "remainingPendingInBatch",
    ],
    mapOutputs: (payload) => ({
      batch_id: String(payload.batchId ?? ""),
      processed_count: Number(payload.processedCount),
      failed_count: Number(payload.failedCount),
      remaining_pending_in_batch: Number(payload.remainingPendingInBatch),
      batch_counts_reconciled:
        payload.batchCountsReconciled === undefined
          ? "unknown"
          : String(Boolean(payload.batchCountsReconciled)),
    }),
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`emitAiGithubOutputs: FAIL - ${message}`);
  process.exit(1);
}
