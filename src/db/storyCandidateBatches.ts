import { getSupabaseClient } from "./supabaseClient";

export type StoryCandidateBatchStatus =
  | "fetching"
  | "fetched"
  | "ai_processing"
  | "ai_completed"
  | "drafting"
  | "completed"
  | "failed";

export interface StoryCandidateBatchRow {
  id: string;
  run_id: string;
  run_label: string | null;
  status: StoryCandidateBatchStatus;
  started_at: string;
  finished_at: string | null;
  scraped_count: number;
  normalized_valid_count: number;
  inserted_count: number;
  duplicate_count: number;
  rejected_count: number;
  ai_processed_count: number;
  ai_failed_count: number;
  gunner_drafted_count: number;
  gunner_failed_count: number;
  workflow_run_id: string | null;
  metadata: Record<string, unknown>;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchCountUpdateInput {
  scrapedCount?: number;
  normalizedValidCount?: number;
  insertedCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
  aiProcessedCount?: number;
  aiFailedCount?: number;
  gunnerDraftedCount?: number;
  gunnerFailedCount?: number;
}

export interface CreateStoryCandidateBatchInput {
  runId: string;
  runLabel?: string | null;
  workflowRunId?: string | null;
  metadata?: Record<string, unknown>;
}

function normalizeBatchError(errorMessage: string, context: string): never {
  const lower = errorMessage.toLowerCase();
  const missingBatchTable =
    lower.includes("story_candidate_batches") ||
    lower.includes("ingestion_batch_id") ||
    lower.includes("ingestion_run_id");
  if (missingBatchTable) {
    throw new Error(
      `${context}: batch schema is missing. Apply Supabase migration 20260615_story_candidate_batches.sql before running live batch mode. Original error: ${errorMessage}`
    );
  }
  throw new Error(`${context}: ${errorMessage}`);
}

function toDbCountUpdate(input: BatchCountUpdateInput): Record<string, number> {
  const update: Record<string, number> = {};
  if (typeof input.scrapedCount === "number") update.scraped_count = input.scrapedCount;
  if (typeof input.normalizedValidCount === "number") {
    update.normalized_valid_count = input.normalizedValidCount;
  }
  if (typeof input.insertedCount === "number") update.inserted_count = input.insertedCount;
  if (typeof input.duplicateCount === "number") update.duplicate_count = input.duplicateCount;
  if (typeof input.rejectedCount === "number") update.rejected_count = input.rejectedCount;
  if (typeof input.aiProcessedCount === "number") update.ai_processed_count = input.aiProcessedCount;
  if (typeof input.aiFailedCount === "number") update.ai_failed_count = input.aiFailedCount;
  if (typeof input.gunnerDraftedCount === "number") {
    update.gunner_drafted_count = input.gunnerDraftedCount;
  }
  if (typeof input.gunnerFailedCount === "number") update.gunner_failed_count = input.gunnerFailedCount;
  return update;
}

export async function createStoryCandidateBatch(
  input: CreateStoryCandidateBatchInput
): Promise<StoryCandidateBatchRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("story_candidate_batches")
    .insert({
      run_id: input.runId,
      run_label: input.runLabel ?? null,
      status: "fetching",
      workflow_run_id: input.workflowRunId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) normalizeBatchError(error.message, "Failed to create story candidate batch");
  return data as unknown as StoryCandidateBatchRow;
}

export async function updateStoryCandidateBatchCounts(
  batchId: string,
  counts: BatchCountUpdateInput
): Promise<void> {
  const update = toDbCountUpdate(counts);
  if (Object.keys(update).length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("story_candidate_batches").update(update).eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to update counts for batch ${batchId}`);
}

export async function markStoryCandidateBatchFetched(
  batchId: string,
  counts: BatchCountUpdateInput
): Promise<void> {
  const update = toDbCountUpdate(counts);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      ...update,
      status: "fetched",
      finished_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} fetched`);
}

export async function markStoryCandidateBatchAiProcessing(batchId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      status: "ai_processing",
      last_error: null,
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} ai_processing`);
}

export async function markStoryCandidateBatchAiCompleted(
  batchId: string,
  counts: BatchCountUpdateInput
): Promise<void> {
  const update = toDbCountUpdate(counts);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      ...update,
      status: "ai_completed",
      finished_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} ai_completed`);
}

export async function markStoryCandidateBatchDrafting(batchId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      status: "drafting",
      last_error: null,
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} drafting`);
}

export async function markStoryCandidateBatchCompleted(
  batchId: string,
  counts: BatchCountUpdateInput
): Promise<void> {
  const update = toDbCountUpdate(counts);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      ...update,
      status: "completed",
      finished_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} completed`);
}

export async function markStoryCandidateBatchFailed(
  batchId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("story_candidate_batches")
    .update({
      status: "failed",
      last_error: errorMessage.slice(0, 2000),
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);
  if (error) normalizeBatchError(error.message, `Failed to mark batch ${batchId} failed`);
}

export async function getStoryCandidateBatch(
  batchId: string
): Promise<StoryCandidateBatchRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("story_candidate_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (error) normalizeBatchError(error.message, `Failed to get batch ${batchId}`);
  return (data as StoryCandidateBatchRow | null) ?? null;
}

export async function getStoryCandidateBatchSummary(
  batchId: string
): Promise<StoryCandidateBatchRow> {
  const batch = await getStoryCandidateBatch(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} was not found`);
  }
  return batch;
}
