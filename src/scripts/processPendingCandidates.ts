/**
 * Step 3 AI worker: reads pending story_candidates, generates a structured
 * draft payload (mock by default), validates it, and writes
 * processed_payload + openai_response + status=processed back to Supabase.
 *
 * No Sanity, no draft creation, no publishing. OpenAI is never called unless
 * AI_PROVIDER=openai is explicitly set with a valid OPENAI_API_KEY.
 */

import * as fs from "fs";
import * as path from "path";
import { getProvider, parseProviderName } from "../ai/getProvider";
import type {
  AiProviderName,
  AiProviderResult,
  WorkerStoryCandidate,
} from "../ai/types";
import { validateProcessedArticle } from "../ai/validateProcessedArticle";
import { parseEnabledSourceKeys } from "../config/ingestionSources";
import {
  claimCandidateForProcessing,
  getBatchCandidateStatusCounts,
  getPendingCandidates,
  markCandidateFailed,
  markCandidateProcessed,
} from "../db/storyCandidates";
import {
  markStoryCandidateBatchAiCompleted,
  markStoryCandidateBatchAiProcessing,
  markStoryCandidateBatchFailed,
} from "../db/storyCandidateBatches";
import { hasSupabaseEnv } from "../db/supabaseClient";

const DEFAULT_LIMIT = 1;
const LARGE_BATCH_THRESHOLD = 5;

const OUTPUT_DIR = path.join(process.cwd(), "audit-output", "ai-worker");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "summary.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "AI_WORKER_AUDIT.md");
const PREVIEW_PATH = path.join(OUTPUT_DIR, "processed-preview.json");
const LATEST_BATCH_PATH = path.join(OUTPUT_DIR, "latest-batch.json");

interface WorkerConfig {
  provider: AiProviderName;
  limit: number | null;
  explicitLimit: boolean;
  dryRun: boolean;
  sourceKeys: Set<string> | null;
  allowLargeBatch: boolean;
  batchId: string | null;
  expectedCount: number | null;
  strictBatchCounts: boolean;
}

interface CandidateOutcome {
  candidateId: string;
  sourceKey: string;
  sourceUrl: string;
  claimed: boolean;
  validated: boolean;
  processed: boolean;
  failed: boolean;
  validationIssues: string[];
  error: string | null;
}

interface PreviewEntry {
  candidateId: string;
  sourceKey: string;
  sourceUrl: string;
  valid: boolean;
  validationIssues: string[];
  payload: AiProviderResult["payload"];
  providerMeta: AiProviderResult["meta"];
}

interface WorkerSummary {
  generatedAt: string;
  provider: AiProviderName;
  dryRun: boolean;
  openAiCalled: boolean;
  supabaseUpdated: boolean;
  limit: number | null;
  sourceKeyFilter: string[] | null;
  batchMode: boolean;
  batchId: string | null;
  expectedCount: number | null;
  strictBatchCounts: boolean;
  selectedCount: number;
  candidatesSelected: number;
  candidatesProcessed: number;
  processedCount: number;
  candidatesFailed: number;
  failedCount: number;
  remainingPendingInBatch: number | null;
  remainingProcessingInBatch: number | null;
  batchCountsReconciled: boolean | null;
  reconcileTotal: number | null;
  candidateIds: string[];
  sourceKeys: string[];
  outcomes: CandidateOutcome[];
}

function parseBoolFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseConfig(argv: string[]): WorkerConfig {
  const provider = parseProviderName(process.env.AI_PROVIDER);
  const rawLimit = process.env.AI_PROCESS_LIMIT;
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : Number.NaN;
  const explicitLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const batchId = process.env.AI_BATCH_ID?.trim() || null;
  const limit =
    explicitLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : batchId
        ? null
        : DEFAULT_LIMIT;

  const dryRun = argv.includes("--dry-run") || parseBoolFlag(process.env.AI_DRY_RUN);
  const sourceKeys = parseEnabledSourceKeys(process.env.AI_SOURCE_KEYS);
  const allowLargeBatch = parseBoolFlag(process.env.AI_ALLOW_LARGE_BATCH);
  const expectedRaw = process.env.AI_EXPECTED_COUNT;
  const parsedExpected = expectedRaw ? parseInt(expectedRaw, 10) : Number.NaN;
  const expectedCount = Number.isFinite(parsedExpected) && parsedExpected >= 0 ? parsedExpected : null;
  const strictBatchCounts = parseBoolFlag(process.env.AI_STRICT_BATCH_COUNTS);

  return {
    provider,
    limit,
    explicitLimit,
    dryRun,
    sourceKeys,
    allowLargeBatch,
    batchId,
    expectedCount,
    strictBatchCounts,
  };
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function printBanner(config: WorkerConfig): void {
  const mode = config.dryRun ? "DRY-RUN (no Supabase writes)" : "REAL (updates Supabase)";
  const providerLabel =
    config.provider === "openai" ? "OPENAI (paid API)" : "MOCK (no external calls)";

  console.log("=".repeat(72));
  console.log("Step 3 AI Worker");
  console.log(`Mode:     ${mode}`);
  console.log(`Provider: ${providerLabel}`);
  console.log(`Limit:    ${config.limit ?? "all for selected queue scope"}`);
  if (config.batchId) {
    console.log(`Batch ID: ${config.batchId}`);
  }
  if (config.sourceKeys) {
    console.log(`Sources:  ${Array.from(config.sourceKeys).join(", ")}`);
  }
  console.log("No Sanity drafts. No publishing.");
  console.log("=".repeat(72));
}

function writeOutputs(summary: WorkerSummary, previews: PreviewEntry[]): void {
  ensureOutputDir();
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
  fs.writeFileSync(PREVIEW_PATH, `${JSON.stringify(previews, null, 2)}\n`, "utf-8");
  fs.writeFileSync(
    LATEST_BATCH_PATH,
    `${JSON.stringify(
      {
        batchId: summary.batchId,
        processedCount: summary.processedCount,
        failedCount: summary.failedCount,
        remainingPendingInBatch: summary.remainingPendingInBatch,
      },
      null,
      2
    )}\n`,
    "utf-8"
  );

  const lines: string[] = [];
  lines.push("# AI Worker Audit");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Run configuration");
  lines.push("");
  lines.push(`- Provider: ${summary.provider}`);
  lines.push(`- Dry-run: ${summary.dryRun}`);
  lines.push(`- OpenAI called: ${summary.openAiCalled}`);
  lines.push(`- Supabase updated: ${summary.supabaseUpdated}`);
  lines.push(`- Limit: ${summary.limit}`);
  lines.push(`- Batch mode: ${summary.batchMode}`);
  lines.push(`- Batch id: ${summary.batchId ?? "none"}`);
  lines.push(`- Expected count: ${summary.expectedCount ?? "none"}`);
  lines.push(`- Strict batch counts: ${summary.strictBatchCounts}`);
  lines.push(
    `- Source key filter: ${
      summary.sourceKeyFilter ? summary.sourceKeyFilter.join(", ") : "none"
    }`
  );
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- Candidates selected: ${summary.candidatesSelected}`);
  lines.push(`- Candidates processed: ${summary.candidatesProcessed}`);
  lines.push(`- Candidates failed: ${summary.candidatesFailed}`);
  lines.push(`- Remaining pending in batch: ${summary.remainingPendingInBatch ?? "n/a"}`);
  lines.push(`- Remaining processing in batch: ${summary.remainingProcessingInBatch ?? "n/a"}`);
  lines.push(`- Batch counts reconciled: ${summary.batchCountsReconciled ?? "n/a"}`);
  lines.push(`- Reconcile total: ${summary.reconcileTotal ?? "n/a"}`);
  lines.push(`- Candidate IDs: ${summary.candidateIds.join(", ") || "none"}`);
  lines.push(`- Source keys: ${summary.sourceKeys.join(", ") || "none"}`);
  lines.push("");
  lines.push("## Per-candidate outcomes");
  lines.push("");
  if (summary.outcomes.length === 0) {
    lines.push("- None");
  } else {
    for (const outcome of summary.outcomes) {
      lines.push(`### ${outcome.candidateId}`);
      lines.push("");
      lines.push(`- Source key: ${outcome.sourceKey}`);
      lines.push(`- Source URL: ${outcome.sourceUrl}`);
      lines.push(`- Claimed: ${outcome.claimed}`);
      lines.push(`- Validated: ${outcome.validated}`);
      lines.push(`- Processed: ${outcome.processed}`);
      lines.push(`- Failed: ${outcome.failed}`);
      if (outcome.validationIssues.length > 0) {
        lines.push(`- Validation issues: ${outcome.validationIssues.join("; ")}`);
      }
      if (outcome.error) {
        lines.push(`- Error: ${outcome.error}`);
      }
      lines.push("");
    }
  }
  lines.push("## Not in scope (this step)");
  lines.push("");
  lines.push("- No Sanity writes");
  lines.push("- No draft creation");
  lines.push("- No publishing");
  lines.push("");

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
}

async function processCandidate(
  candidate: WorkerStoryCandidate,
  config: WorkerConfig,
  provider: ReturnType<typeof getProvider>,
  previews: PreviewEntry[]
): Promise<CandidateOutcome> {
  const outcome: CandidateOutcome = {
    candidateId: candidate.id,
    sourceKey: candidate.source_key,
    sourceUrl: candidate.source_url,
    claimed: false,
    validated: false,
    processed: false,
    failed: false,
    validationIssues: [],
    error: null,
  };

  // Dry-run: generate + validate only, never touch Supabase.
  if (config.dryRun) {
    const result = await provider.generateArticleDraft(candidate);
    const validation = validateProcessedArticle(result.payload, {
      expectedSourceUrl: candidate.source_url,
    });
    outcome.validated = validation.valid;
    outcome.validationIssues = validation.reasons;
    previews.push({
      candidateId: candidate.id,
      sourceKey: candidate.source_key,
      sourceUrl: candidate.source_url,
      valid: validation.valid,
      validationIssues: validation.reasons,
      payload: result.payload,
      providerMeta: result.meta,
    });
    return outcome;
  }

  // Real mode: claim -> generate -> validate -> processed/failed.
  const claimed = await claimCandidateForProcessing(
    candidate.id,
    candidate.attempt_count
  );
  if (!claimed) {
    outcome.error = "Candidate was not in 'pending' state at claim time (race or already processing)";
    return outcome;
  }
  outcome.claimed = true;

  try {
    const result = await provider.generateArticleDraft(claimed);
    const validation = validateProcessedArticle(result.payload, {
      expectedSourceUrl: claimed.source_url,
    });

    previews.push({
      candidateId: claimed.id,
      sourceKey: claimed.source_key,
      sourceUrl: claimed.source_url,
      valid: validation.valid,
      validationIssues: validation.reasons,
      payload: result.payload,
      providerMeta: result.meta,
    });

    if (!validation.valid) {
      outcome.validationIssues = validation.reasons;
      const message = `Validation failed: ${validation.reasons.join("; ")}`;
      await markCandidateFailed(claimed.id, message);
      outcome.failed = true;
      outcome.error = message;
      return outcome;
    }

    outcome.validated = true;
    await markCandidateProcessed(claimed.id, result.payload, result.meta);
    outcome.processed = true;
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markCandidateFailed(claimed.id, message);
    outcome.failed = true;
    outcome.error = message;
    return outcome;
  }
}

async function main(): Promise<void> {
  const config = parseConfig(process.argv.slice(2));
  printBanner(config);

  if (
    config.limit &&
    config.explicitLimit &&
    config.limit > LARGE_BATCH_THRESHOLD &&
    !config.allowLargeBatch
  ) {
    console.error(
      `Refusing to process ${config.limit} candidates. Limit is capped at ${LARGE_BATCH_THRESHOLD} unless AI_ALLOW_LARGE_BATCH=true.`
    );
    process.exit(1);
  }

  if (!hasSupabaseEnv()) {
    console.error(
      "Missing Supabase environment. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  // Construct provider before claiming anything; OpenAI provider throws here
  // if AI_PROVIDER=openai but no key is present.
  let provider: ReturnType<typeof getProvider>;
  try {
    provider = getProvider(config.provider);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }

  if (config.batchId && !config.dryRun) {
    await markStoryCandidateBatchAiProcessing(config.batchId);
  }

  const candidates = await getPendingCandidates(config.limit, config.sourceKeys, config.batchId);

  const previews: PreviewEntry[] = [];
  const outcomes: CandidateOutcome[] = [];

  for (const candidate of candidates) {
    const outcome = await processCandidate(candidate, config, provider, previews);
    outcomes.push(outcome);
  }

  const candidatesProcessed = outcomes.filter((o) => o.processed).length;
  const candidatesFailed = outcomes.filter((o) => o.failed).length;
  const supabaseUpdated = !config.dryRun && (candidatesProcessed > 0 || candidatesFailed > 0);

  let remainingPendingInBatch: number | null = null;
  let remainingProcessingInBatch: number | null = null;
  let batchCountsReconciled: boolean | null = null;
  let reconcileTotal: number | null = null;

  if (config.batchId) {
    const counts = await getBatchCandidateStatusCounts(config.batchId);
    remainingPendingInBatch = counts.pending;
    remainingProcessingInBatch = counts.processing;
    const processedTotal = counts.processed + counts.draft_created;
    const failedTotal = counts.failed;
    reconcileTotal = processedTotal + failedTotal + remainingPendingInBatch;
    batchCountsReconciled =
      config.expectedCount === null ? null : config.expectedCount === reconcileTotal;

    if (!config.dryRun) {
      const isComplete =
        remainingPendingInBatch === 0 &&
        remainingProcessingInBatch === 0 &&
        (config.expectedCount === null || batchCountsReconciled === true);
      if (isComplete) {
        await markStoryCandidateBatchAiCompleted(config.batchId, {
          aiProcessedCount: processedTotal,
          aiFailedCount: failedTotal,
        });
      }
    }
  }

  const summary: WorkerSummary = {
    generatedAt: new Date().toISOString(),
    provider: config.provider,
    dryRun: config.dryRun,
    openAiCalled: config.provider === "openai" && !config.dryRun && candidates.length > 0,
    supabaseUpdated,
    limit: config.limit,
    batchMode: Boolean(config.batchId),
    batchId: config.batchId,
    expectedCount: config.expectedCount,
    strictBatchCounts: config.strictBatchCounts,
    sourceKeyFilter: config.sourceKeys ? Array.from(config.sourceKeys) : null,
    selectedCount: candidates.length,
    candidatesSelected: candidates.length,
    candidatesProcessed,
    processedCount: candidatesProcessed,
    candidatesFailed,
    failedCount: candidatesFailed,
    remainingPendingInBatch,
    remainingProcessingInBatch,
    batchCountsReconciled,
    reconcileTotal,
    candidateIds: candidates.map((c) => c.id),
    sourceKeys: Array.from(new Set(candidates.map((c) => c.source_key))),
    outcomes,
  };

  writeOutputs(summary, previews);

  console.log("");
  console.log(`Candidates selected:  ${summary.candidatesSelected}`);
  console.log(`Candidates processed: ${summary.candidatesProcessed}`);
  console.log(`Candidates failed:    ${summary.candidatesFailed}`);
  console.log(`Batch mode:           ${summary.batchMode}`);
  console.log(`Batch id:             ${summary.batchId ?? "none"}`);
  console.log(`Remaining pending:    ${summary.remainingPendingInBatch ?? "n/a"}`);
  console.log(`Reconciled:           ${summary.batchCountsReconciled ?? "n/a"}`);
  console.log(`Supabase updated:     ${summary.supabaseUpdated}`);
  console.log(`OpenAI called:        ${summary.openAiCalled}`);
  console.log(`Reports:              ${path.relative(process.cwd(), OUTPUT_DIR)}`);

  if (config.batchId && config.expectedCount !== null && summary.batchCountsReconciled === false) {
    const msg = `AI batch ${config.batchId} expected ${config.expectedCount}, got reconcile total ${summary.reconcileTotal}`;
    console.error(msg);
    if (!config.dryRun) {
      await markStoryCandidateBatchFailed(config.batchId, msg);
    }
    if (config.strictBatchCounts) {
      process.exit(1);
    }
  }

  if (candidatesFailed > 0 && candidatesProcessed === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const batchId = process.env.AI_BATCH_ID?.trim();
  if (batchId && !parseBoolFlag(process.env.AI_DRY_RUN)) {
    void markStoryCandidateBatchFailed(
      batchId,
      error instanceof Error ? error.message : String(error)
    );
  }
  console.error("AI worker failed:", error);
  process.exit(1);
});
