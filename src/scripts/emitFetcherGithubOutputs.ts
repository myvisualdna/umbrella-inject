import * as path from "path";
import {
  emitGithubOutputsFromArtifact,
  parseAllowMissing,
} from "./githubOutputUtils";

const ARTIFACT_PATH = path.join(
  process.cwd(),
  "audit-output",
  "fetcher-worker",
  "latest-batch.json"
);

function main(): void {
  emitGithubOutputsFromArtifact({
    allowMissing: parseAllowMissing(process.argv.slice(2)),
    stageLabel: "Fetcher",
    artifactPath: ARTIFACT_PATH,
    requiredFields: [
      "batchId",
      "runId",
      "insertedCount",
      "normalizedValidCount",
      "duplicateCount",
    ],
    mapOutputs: (payload) => ({
      batch_id: String(payload.batchId),
      inserted_count: Number(payload.insertedCount),
      normalized_valid_count: Number(payload.normalizedValidCount),
      duplicate_count: Number(payload.duplicateCount),
      run_id: String(payload.runId),
    }),
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`emitFetcherGithubOutputs: FAIL - ${message}`);
  process.exit(1);
}
