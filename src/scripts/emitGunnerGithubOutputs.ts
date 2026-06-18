import * as path from "path";
import {
  emitGithubOutputsFromArtifact,
  parseAllowMissing,
} from "./githubOutputUtils";

const ARTIFACT_PATH = path.join(
  process.cwd(),
  "audit-output",
  "gunner-worker",
  "latest-batch.json"
);

function main(): void {
  emitGithubOutputsFromArtifact({
    allowMissing: parseAllowMissing(process.argv.slice(2)),
    stageLabel: "Gunner",
    artifactPath: ARTIFACT_PATH,
    requiredFields: [
      "batchId",
      "draftedCount",
      "failedCount",
      "remainingProcessedInBatch",
    ],
    mapOutputs: (payload) => ({
      batch_id: String(payload.batchId ?? ""),
      drafted_count: Number(payload.draftedCount),
      failed_count: Number(payload.failedCount),
      remaining_processed_in_batch: Number(payload.remainingProcessedInBatch),
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
  console.error(`emitGunnerGithubOutputs: FAIL - ${message}`);
  process.exit(1);
}
