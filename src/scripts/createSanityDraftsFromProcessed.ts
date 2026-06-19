/**
 * Step 4 Gunner Worker: reads `processed` story_candidates, maps each
 * processed_payload into an Angle Sanity `post` draft, and (when writes are
 * enabled) creates a draft-only document then transitions the candidate to
 * status=draft_created with its sanity_document_id.
 *
 * Safety:
 * - Dry-run by default. Real writes require GUNNER_WRITE_ENABLED=true.
 * - Draft-only: deterministic `drafts.ingest-{id}` ids, status "draft".
 * - Never calls OpenAI / the AI worker. Never publishes. Never sets
 *   publishedAt / homepage flags. createIfNotExists (no overwrite) by default.
 */

import * as fs from "fs";
import * as path from "path";
import { validateProcessedArticle } from "../ai/validateProcessedArticle";
import { parseEnabledSourceKeys } from "../config/ingestionSources";
import {
  getBatchCandidateStatusCounts,
  getProcessedCandidates,
  lookupCandidateById,
  markCandidateDraftCreated,
  markCandidateGunnerFailed,
  type ProcessedCandidateRow,
} from "../db/storyCandidates";
import {
  markStoryCandidateBatchCompleted,
  markStoryCandidateBatchDrafting,
  markStoryCandidateBatchFailed,
} from "../db/storyCandidateBatches";
import { hasSupabaseEnv } from "../db/supabaseClient";
import {
  refreshSanityCaches,
  type RefreshSanityCachesResult,
} from "../sanity/refreshSanityCaches";
import {
  parsePlaceholderCoverConfig,
  type PlaceholderCoverConfig,
} from "../gunnerWorker/cover";
import { mapProcessedPayloadToSanityDraft } from "../gunnerWorker/mapProcessedPayloadToSanityDraft";
import { createDraft, sanityDocumentExists } from "../gunnerWorker/sanityDraftClient";
import type {
  GunnerCandidateOutcome,
  GunnerDraftPreviewEntry,
} from "../gunnerWorker/types";
import { validateSanityDraftPayload } from "../gunnerWorker/validateSanityDraftPayload";

const DEFAULT_LIMIT = 1;
const LARGE_BATCH_THRESHOLD = 5;

const OUTPUT_DIR = path.join(process.cwd(), "audit-output", "gunner-worker");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "summary.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "GUNNER_WORKER_AUDIT.md");
const PREVIEW_PATH = path.join(OUTPUT_DIR, "sanity-draft-preview.json");
const LATEST_BATCH_PATH = path.join(OUTPUT_DIR, "latest-batch.json");

interface WorkerConfig {
  writeEnabled: boolean;
  dryRun: boolean;
  limit: number | null;
  explicitLimit: boolean;
  sourceKeys: Set<string> | null;
  candidateId: string | null;
  batchId: string | null;
  expectedCount: number | null;
  strictBatchCounts: boolean;
  refreshSanityCache: boolean;
  overwriteDraft: boolean;
  defaultAuthorId: string | null;
  placeholderCover: PlaceholderCoverConfig;
  allowLargeBatch: boolean;
}

interface WorkerSummary {
  generatedAt: string;
  dryRun: boolean;
  writeEnabled: boolean;
  sanityCalled: boolean;
  supabaseUpdated: boolean;
  overwriteDraft: boolean;
  limit: number | null;
  batchMode: boolean;
  batchId: string | null;
  expectedCount: number | null;
  strictBatchCounts: boolean;
  sourceKeyFilter: string[] | null;
  candidateIdFilter: string | null;
  cacheRefreshEnabled: boolean;
  cacheRefresh: RefreshSanityCachesResult | null;
  candidatesSelected: number;
  candidatesMapped: number;
  candidatesDrafted: number;
  draftedCount: number;
  candidatesSkippedExisting: number;
  candidatesFailed: number;
  failedCount: number;
  selectedCount: number;
  remainingProcessedInBatch: number | null;
  batchCountsReconciled: boolean | null;
  reconcileTotal: number | null;
  candidateIds: string[];
  sanityDocumentIds: string[];
  publishingPerformed: false;
  statusWritten: "draft";
  outcomes: GunnerCandidateOutcome[];
}

function parseBoolFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseConfig(argv: string[]): WorkerConfig {
  const writeEnabled = parseBoolFlag(process.env.GUNNER_WRITE_ENABLED);
  // Dry-run when explicitly requested OR when writes are not enabled.
  const dryRun = argv.includes("--dry-run") || !writeEnabled;

  const rawLimit = process.env.GUNNER_LIMIT;
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : Number.NaN;
  const explicitLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const batchId = process.env.GUNNER_BATCH_ID?.trim() || null;
  const limit = explicitLimit ? parsedLimit : batchId ? null : DEFAULT_LIMIT;

  const sourceKeys = parseEnabledSourceKeys(process.env.GUNNER_SOURCE_KEYS);
  const candidateId = process.env.GUNNER_CANDIDATE_ID?.trim() || null;
  const expectedRaw = process.env.GUNNER_EXPECTED_COUNT;
  const parsedExpected = expectedRaw ? parseInt(expectedRaw, 10) : Number.NaN;
  const expectedCount = Number.isFinite(parsedExpected) && parsedExpected >= 0 ? parsedExpected : null;
  const strictBatchCounts = parseBoolFlag(process.env.GUNNER_STRICT_BATCH_COUNTS);
  const refreshEnv = process.env.GUNNER_REFRESH_SANITY_CACHE;
  const refreshSanityCache =
    refreshEnv === "true" || refreshEnv === "1"
      ? true
      : refreshEnv === "false" || refreshEnv === "0"
        ? false
        : !dryRun;
  const overwriteDraft = parseBoolFlag(process.env.GUNNER_OVERWRITE_DRAFT);
  const defaultAuthorId = process.env.GUNNER_DEFAULT_AUTHOR_ID?.trim() || null;
  const placeholderCover = parsePlaceholderCoverConfig();
  const allowLargeBatch = parseBoolFlag(process.env.GUNNER_ALLOW_LARGE_BATCH);

  return {
    writeEnabled,
    dryRun,
    limit,
    explicitLimit,
    sourceKeys,
    candidateId,
    batchId,
    expectedCount,
    strictBatchCounts,
    refreshSanityCache,
    overwriteDraft,
    defaultAuthorId,
    placeholderCover,
    allowLargeBatch,
  };
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function printBanner(config: WorkerConfig): void {
  const mode = config.dryRun
    ? "DRY-RUN (no Sanity writes, no Supabase changes)"
    : "WRITE (creates Sanity drafts + updates Supabase)";

  console.log("=".repeat(72));
  console.log("Step 4 Gunner Worker (processed -> draft_created)");
  console.log(`Mode:            ${mode}`);
  console.log(`Write enabled:   ${config.writeEnabled}`);
  console.log(`Limit:           ${config.limit ?? "all for selected queue scope"}`);
  if (config.batchId) {
    console.log(`Batch ID:        ${config.batchId}`);
  }
  console.log(`Overwrite draft: ${config.overwriteDraft}`);
  console.log(`Refresh cache:   ${config.refreshSanityCache}`);
  if (config.candidateId) {
    console.log(`Candidate id:    ${config.candidateId}`);
  }
  if (config.sourceKeys) {
    console.log(`Sources:         ${Array.from(config.sourceKeys).join(", ")}`);
  }
  if (config.defaultAuthorId) {
    console.log(`Default author:  ${config.defaultAuthorId}`);
  }
  console.log(`Cover source:    ${config.placeholderCover.source} (placeholder)`);
  console.log("Draft-only. No publishing. No homepage flags.");
  console.log("=".repeat(72));
}

function writeOutputs(
  summary: WorkerSummary,
  previews: GunnerDraftPreviewEntry[]
): void {
  ensureOutputDir();
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
  fs.writeFileSync(PREVIEW_PATH, `${JSON.stringify(previews, null, 2)}\n`, "utf-8");
  fs.writeFileSync(
    LATEST_BATCH_PATH,
    `${JSON.stringify(
      {
        batchId: summary.batchId,
        draftedCount: summary.draftedCount,
        failedCount: summary.failedCount,
        remainingProcessedInBatch: summary.remainingProcessedInBatch,
      },
      null,
      2
    )}\n`,
    "utf-8"
  );

  const lines: string[] = [];
  lines.push("# Gunner Worker Audit (Step 4)");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Run configuration");
  lines.push("");
  lines.push(`- Mode: ${summary.dryRun ? "DRY-RUN" : "WRITE"}`);
  lines.push(`- Write enabled: ${summary.writeEnabled}`);
  lines.push(`- Sanity called: ${summary.sanityCalled}`);
  lines.push(`- Supabase updated: ${summary.supabaseUpdated}`);
  lines.push(`- Overwrite draft: ${summary.overwriteDraft}`);
  lines.push(`- Limit: ${summary.limit}`);
  lines.push(`- Batch mode: ${summary.batchMode}`);
  lines.push(`- Batch id: ${summary.batchId ?? "none"}`);
  lines.push(`- Expected count: ${summary.expectedCount ?? "none"}`);
  lines.push(`- Strict batch counts: ${summary.strictBatchCounts}`);
  lines.push(`- Refresh Sanity cache: ${summary.cacheRefreshEnabled}`);
  lines.push(`- Candidate ID filter: ${summary.candidateIdFilter ?? "none"}`);
  lines.push(
    `- Source key filter: ${
      summary.sourceKeyFilter ? summary.sourceKeyFilter.join(", ") : "none"
    }`
  );
  if (summary.cacheRefresh) {
    lines.push(
      `- Cache refresh loaded: categories=${summary.cacheRefresh.categoriesLoaded}, tags=${summary.cacheRefresh.tagsLoaded}, authors=${summary.cacheRefresh.authorsLoaded}`
    );
    lines.push(
      `- Cache refresh target: ${summary.cacheRefresh.projectId}/${summary.cacheRefresh.dataset}`
    );
  }
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- Candidates selected: ${summary.candidatesSelected}`);
  lines.push(`- Candidates mapped: ${summary.candidatesMapped}`);
  lines.push(`- Drafts created: ${summary.candidatesDrafted}`);
  lines.push(`- Drafts skipped (already existed): ${summary.candidatesSkippedExisting}`);
  lines.push(`- Candidates failed: ${summary.candidatesFailed}`);
  lines.push(`- Remaining processed in batch: ${summary.remainingProcessedInBatch ?? "n/a"}`);
  lines.push(`- Batch counts reconciled: ${summary.batchCountsReconciled ?? "n/a"}`);
  lines.push(`- Reconcile total: ${summary.reconcileTotal ?? "n/a"}`);
  lines.push(`- Candidate IDs: ${summary.candidateIds.join(", ") || "none"}`);
  lines.push(`- Sanity document IDs: ${summary.sanityDocumentIds.join(", ") || "none"}`);
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
      lines.push(`- Sanity document id: ${outcome.sanityDocumentId ?? "none"}`);
      lines.push(`- Mapped: ${outcome.mapped}`);
      lines.push(`- Drafted: ${outcome.drafted}`);
      lines.push(`- Skipped existing: ${outcome.skippedExisting}`);
      lines.push(`- Failed: ${outcome.failed}`);
      if (outcome.validationIssues.length > 0) {
        lines.push(`- Validation issues: ${outcome.validationIssues.join("; ")}`);
      }
      if (outcome.warnings.length > 0) {
        lines.push(`- Warnings: ${outcome.warnings.join("; ")}`);
      }
      if (outcome.error) {
        lines.push(`- Error: ${outcome.error}`);
      }
      lines.push("");
    }
  }
  lines.push("## Safety confirmation");
  lines.push("");
  lines.push("- Publishing performed: false");
  lines.push('- Status written: "draft" only');
  lines.push("- No publishedAt / homepage / editorial flags set");
  lines.push("- No OpenAI / AI worker calls");
  lines.push("");

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
}

async function selectCandidates(config: WorkerConfig): Promise<ProcessedCandidateRow[]> {
  if (config.batchId && config.candidateId) {
    throw new Error("Cannot use GUNNER_BATCH_ID and GUNNER_CANDIDATE_ID together");
  }

  if (!config.candidateId) {
    return getProcessedCandidates(config.limit, config.sourceKeys, config.batchId);
  }

  const candidate = await lookupCandidateById(config.candidateId);
  if (!candidate) {
    throw new Error(`Candidate ${config.candidateId} was not found`);
  }
  if (candidate.status !== "processed") {
    throw new Error(
      `Candidate ${config.candidateId} is not processed (current status: ${candidate.status})`
    );
  }
  if (!candidate.processed_payload) {
    throw new Error(`Candidate ${config.candidateId} has no processed_payload`);
  }
  if (candidate.sanity_document_id) {
    throw new Error(
      `Candidate ${config.candidateId} already has sanity_document_id ${candidate.sanity_document_id}`
    );
  }
  if (config.sourceKeys && !config.sourceKeys.has(candidate.source_key)) {
    throw new Error(
      `Candidate ${config.candidateId} source_key ${candidate.source_key} does not match GUNNER_SOURCE_KEYS`
    );
  }

  return [candidate];
}

async function processCandidate(
  candidate: ProcessedCandidateRow,
  config: WorkerConfig,
  previews: GunnerDraftPreviewEntry[]
): Promise<GunnerCandidateOutcome> {
  const outcome: GunnerCandidateOutcome = {
    candidateId: candidate.id,
    sourceKey: candidate.source_key,
    sourceUrl: candidate.source_url,
    sanityDocumentId: null,
    mapped: false,
    drafted: false,
    failed: false,
    skippedExisting: false,
    validationIssues: [],
    warnings: [],
    error: null,
  };

  if (!candidate.processed_payload) {
    outcome.failed = true;
    outcome.error = "Candidate has no processed_payload";
    if (!config.dryRun) {
      await markCandidateGunnerFailed(candidate.id, outcome.error);
    }
    return outcome;
  }

  // Re-validate the stored payload against the AI-worker contract before mapping.
  const inputValidation = validateProcessedArticle(candidate.processed_payload, {
    expectedSourceUrl: candidate.source_url,
  });
  if (!inputValidation.valid) {
    outcome.failed = true;
    outcome.validationIssues = inputValidation.reasons;
    outcome.error = `processed_payload failed validation: ${inputValidation.reasons.join("; ")}`;
    if (!config.dryRun) {
      await markCandidateGunnerFailed(candidate.id, outcome.error);
    }
    return outcome;
  }

  const mapping = mapProcessedPayloadToSanityDraft(
    candidate.id,
    candidate.processed_payload,
    candidate.raw_payload,
    {
      defaultAuthorId: config.defaultAuthorId,
      placeholderCover: config.placeholderCover,
    }
  );
  outcome.mapped = true;
  outcome.warnings = mapping.warnings;

  const draftValidation = validateSanityDraftPayload(mapping.draft);
  outcome.validationIssues = draftValidation.issues;

  previews.push({
    candidateId: candidate.id,
    sourceKey: candidate.source_key,
    sourceUrl: candidate.source_url,
    valid: draftValidation.valid,
    validationIssues: draftValidation.issues,
    warnings: mapping.warnings,
    draft: mapping.draft,
  });

  if (!draftValidation.valid) {
    outcome.failed = true;
    outcome.error = `Draft validation failed: ${draftValidation.issues.join("; ")}`;
    if (!config.dryRun) {
      await markCandidateGunnerFailed(candidate.id, outcome.error);
    }
    return outcome;
  }

  // Dry-run stops here: preview only, no Sanity / Supabase writes.
  if (config.dryRun) {
    return outcome;
  }

  try {
    const result = await createDraft(mapping.draft, { overwrite: config.overwriteDraft });
    outcome.sanityDocumentId = result.sanityDocumentId;
    outcome.skippedExisting = result.skippedExisting;
    outcome.drafted = result.created;

    await markCandidateDraftCreated(candidate.id, result.sanityDocumentId);
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome.failed = true;
    outcome.error = message;
    await markCandidateGunnerFailed(candidate.id, message);
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
  if (config.batchId && !config.dryRun) {
    await markStoryCandidateBatchDrafting(config.batchId);
  }

    console.error(
      `Refusing to process ${config.limit} candidates. Limit is capped at ${LARGE_BATCH_THRESHOLD} unless GUNNER_ALLOW_LARGE_BATCH=true.`
    );
    process.exit(1);
  }

  if (!hasSupabaseEnv()) {
    console.error(
      "Missing Supabase environment. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  let cacheRefreshResult: RefreshSanityCachesResult | null = null;
  if (config.refreshSanityCache) {
    try {
      cacheRefreshResult = await refreshSanityCaches();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!config.dryRun) {
        throw new Error(`Sanity cache refresh failed before write mode: ${message}`);
      }
      console.warn(
        `Warning: cache refresh failed in dry-run mode (${message}). Continuing with existing local cache.`
      );
    }
  }

  if (config.defaultAuthorId) {
    const authorExists = await sanityDocumentExists(config.defaultAuthorId);
    if (!authorExists) {
      throw new Error(
        `Configured GUNNER_DEFAULT_AUTHOR_ID ${config.defaultAuthorId} does not exist in Sanity`
      );
    }
  }

  const candidates = await selectCandidates(config);

  const previews: GunnerDraftPreviewEntry[] = [];
  const outcomes: GunnerCandidateOutcome[] = [];

  for (const candidate of candidates) {
    const outcome = await processCandidate(candidate, config, previews);
    outcomes.push(outcome);
  }

  const candidatesMapped = outcomes.filter((o) => o.mapped).length;
  const candidatesDrafted = outcomes.filter((o) => o.drafted).length;
  const candidatesSkippedExisting = outcomes.filter((o) => o.skippedExisting).length;
  const candidatesFailed = outcomes.filter((o) => o.failed).length;
  const sanityCalled =
    !config.dryRun && (candidatesDrafted > 0 || candidatesSkippedExisting > 0);
  const supabaseUpdated =
    !config.dryRun && (candidatesDrafted > 0 || candidatesSkippedExisting > 0);

  let remainingProcessedInBatch: number | null = null;
  let batchCountsReconciled: boolean | null = null;
  let reconcileTotal: number | null = null;
  if (config.batchId) {
    const counts = await getBatchCandidateStatusCounts(config.batchId);
    const remainingProcessedExcludingFailures = Math.max(counts.processed - candidatesFailed, 0);
    remainingProcessedInBatch = remainingProcessedExcludingFailures;
    const draftedTotal = counts.draft_created;
    reconcileTotal = draftedTotal + candidatesFailed + remainingProcessedExcludingFailures;
    batchCountsReconciled =
      config.expectedCount === null ? null : config.expectedCount === reconcileTotal;

    if (!config.dryRun) {
      const isComplete =
        remainingProcessedExcludingFailures === 0 &&
        (config.expectedCount === null || batchCountsReconciled === true);
      if (isComplete) {
        await markStoryCandidateBatchCompleted(config.batchId, {
          gunnerDraftedCount: draftedTotal,
          gunnerFailedCount: counts.failed + candidatesFailed,
        });
      }
    }
  }

  const summary: WorkerSummary = {
    generatedAt: new Date().toISOString(),
    dryRun: config.dryRun,
    writeEnabled: config.writeEnabled,
    sanityCalled,
    supabaseUpdated,
    overwriteDraft: config.overwriteDraft,
    limit: config.limit,
    batchMode: Boolean(config.batchId),
    batchId: config.batchId,
    expectedCount: config.expectedCount,
    strictBatchCounts: config.strictBatchCounts,
    sourceKeyFilter: config.sourceKeys ? Array.from(config.sourceKeys) : null,
    candidateIdFilter: config.candidateId,
    cacheRefreshEnabled: config.refreshSanityCache,
    cacheRefresh: cacheRefreshResult,
    candidatesSelected: candidates.length,
    candidatesMapped,
    candidatesDrafted,
    draftedCount: candidatesDrafted,
    candidatesSkippedExisting,
    candidatesFailed,
    failedCount: candidatesFailed,
    selectedCount: candidates.length,
    remainingProcessedInBatch,
    batchCountsReconciled,
    reconcileTotal,
    candidateIds: candidates.map((c) => c.id),
    sanityDocumentIds: outcomes
      .map((o) => o.sanityDocumentId)
      .filter((id): id is string => Boolean(id)),
    publishingPerformed: false,
    statusWritten: "draft",
    outcomes,
  };

  writeOutputs(summary, previews);

  console.log("");
  console.log(`Candidates selected:        ${summary.candidatesSelected}`);
  console.log(`Candidates mapped:          ${summary.candidatesMapped}`);
  console.log(`Drafts created:             ${summary.candidatesDrafted}`);
  console.log(`Drafts skipped (existing):  ${summary.candidatesSkippedExisting}`);
  console.log(`Candidates failed:          ${summary.candidatesFailed}`);
  console.log(`Batch mode:                 ${summary.batchMode}`);
  console.log(`Batch id:                   ${summary.batchId ?? "none"}`);
  console.log(`Remaining processed:        ${summary.remainingProcessedInBatch ?? "n/a"}`);
  console.log(`Reconciled:                 ${summary.batchCountsReconciled ?? "n/a"}`);
  console.log(`Sanity called:              ${summary.sanityCalled}`);
  console.log(`Supabase updated:           ${summary.supabaseUpdated}`);
  console.log(`Reports:                    ${path.relative(process.cwd(), OUTPUT_DIR)}`);

  if (config.batchId && config.expectedCount !== null && summary.batchCountsReconciled === false) {
    const msg = `Gunner batch ${config.batchId} expected ${config.expectedCount}, got reconcile total ${summary.reconcileTotal}`;
    console.error(msg);
    if (!config.dryRun) {
      await markStoryCandidateBatchFailed(config.batchId, msg);
    }
    if (config.strictBatchCounts) {
      process.exit(1);
    }
  }

  if (candidatesFailed > 0 && candidatesDrafted === 0 && candidatesSkippedExisting === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const batchId = process.env.GUNNER_BATCH_ID?.trim();
  const writeEnabled = process.env.GUNNER_WRITE_ENABLED === "true" || process.env.GUNNER_WRITE_ENABLED === "1";
  const dryRun = process.argv.includes("--dry-run") || !writeEnabled;
  if (batchId && !dryRun) {
    void markStoryCandidateBatchFailed(batchId, error instanceof Error ? error.message : String(error));
  }
  console.error("Gunner worker failed:", error);
  process.exit(1);
});
