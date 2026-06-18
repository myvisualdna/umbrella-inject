/**
 * Safe local verification that batch rollout readiness tooling is in place.
 * No OpenAI calls. No Sanity writes. No publishing.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { hasSupabaseEnv } from "../db/supabaseClient";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function parseStrictDb(): boolean {
  return process.env.PIPELINE_STRICT_DB === "true" || process.env.PIPELINE_STRICT_DB === "1";
}

function readJsonIfExists(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  assert(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed), `Invalid JSON: ${filePath}`);
  return parsed as Record<string, unknown>;
}

function validateFetcherArtifact(payload: Record<string, unknown>): void {
  for (const field of ["batchId", "runId", "insertedCount", "normalizedValidCount", "duplicateCount"]) {
    assert(field in payload, `Fetcher latest-batch missing ${field}`);
  }
}

function validateAiArtifact(payload: Record<string, unknown>): void {
  for (const field of ["processedCount", "failedCount", "remainingPendingInBatch"]) {
    assert(field in payload, `AI latest-batch missing ${field}`);
  }
}

function validateGunnerArtifact(payload: Record<string, unknown>): void {
  for (const field of ["draftedCount", "failedCount", "remainingProcessedInBatch"]) {
    assert(field in payload, `Gunner latest-batch missing ${field}`);
  }
}

function runCommand(command: string): void {
  execSync(command, {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf-8",
    env: process.env,
  });
}

function verifyDocsAndEnvNames(): void {
  const docs = [
    path.join(process.cwd(), "docs", "batch-aware-orchestration.md"),
    path.join(process.cwd(), "docs", "production-pipeline-scheduling.md"),
    path.join(process.cwd(), "docs", "github-actions-batch-handoff.md"),
  ];
  for (const docPath of docs) {
    assert(fs.existsSync(docPath), `Missing doc: ${path.relative(process.cwd(), docPath)}`);
  }

  const aiScript = fs.readFileSync(
    path.join(process.cwd(), "src", "scripts", "processPendingCandidates.ts"),
    "utf-8"
  );
  const gunnerScript = fs.readFileSync(
    path.join(process.cwd(), "src", "scripts", "createSanityDraftsFromProcessed.ts"),
    "utf-8"
  );
  const storyCandidates = fs.readFileSync(
    path.join(process.cwd(), "src", "db", "storyCandidates.ts"),
    "utf-8"
  );

  assert(aiScript.includes("AI_BATCH_ID"), "AI batch env not documented in script");
  assert(gunnerScript.includes("GUNNER_BATCH_ID"), "Gunner batch env not documented in script");
  assert(storyCandidates.includes("batchId?: string | null"), "Queue fallback batch filter missing");
}

function verifyGithubOutputScripts(): void {
  runCommand("npm run github:outputs:fetcher -- --allow-missing");
  runCommand("npm run github:outputs:ai -- --allow-missing");
  runCommand("npm run github:outputs:gunner -- --allow-missing");
}

function verifyMigrationCheck(strictDb: boolean): { applied: boolean; message: string } {
  if (!hasSupabaseEnv()) {
    const message = "Supabase env not configured; migration check skipped";
    if (strictDb) throw new Error(message);
    return { applied: false, message };
  }

  try {
    runCommand("npm run db:verify-batch-migration");
    return { applied: true, message: "Batch migration appears applied" };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Batch migration verification failed (migration likely pending)";
    if (strictDb) {
      throw new Error(`PIPELINE_STRICT_DB=true and migration check failed: ${message}`);
    }
    return { applied: false, message: "Batch migration pending or not verified" };
  }
}

async function main(): Promise<void> {
  const strictDb = parseStrictDb();
  console.log("verifyBatchPipelineReadiness: starting safe checks");
  console.log(`PIPELINE_STRICT_DB=${strictDb}`);

  const migration = verifyMigrationCheck(strictDb);

  const fetcherArtifact = readJsonIfExists(
    path.join(process.cwd(), "audit-output", "fetcher-worker", "latest-batch.json")
  );
  const aiArtifact = readJsonIfExists(
    path.join(process.cwd(), "audit-output", "ai-worker", "latest-batch.json")
  );
  const gunnerArtifact = readJsonIfExists(
    path.join(process.cwd(), "audit-output", "gunner-worker", "latest-batch.json")
  );

  if (fetcherArtifact) validateFetcherArtifact(fetcherArtifact);
  if (aiArtifact) validateAiArtifact(aiArtifact);
  if (gunnerArtifact) validateGunnerArtifact(gunnerArtifact);

  verifyDocsAndEnvNames();
  verifyGithubOutputScripts();

  console.log("");
  console.log("verifyBatchPipelineReadiness: PASS");
  console.log(
    JSON.stringify(
      {
        migrationApplied: migration.applied,
        migrationMessage: migration.message,
        fetcherArtifactPresent: Boolean(fetcherArtifact),
        aiArtifactPresent: Boolean(aiArtifact),
        gunnerArtifactPresent: Boolean(gunnerArtifact),
        openAiCalled: false,
        sanityWrite: false,
        publishingPerformed: false,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`verifyBatchPipelineReadiness: FAIL - ${message}`);
  process.exit(1);
});
