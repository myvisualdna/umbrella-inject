import type { NormalizedStoryCandidate } from "../normalization/types";
import { validateNormalizedCandidate } from "../normalization/validateNormalizedCandidate";
import type {
  AiProviderMeta,
  ProcessedArticlePayload,
  WorkerStoryCandidate,
} from "../ai/types";
import { getSupabaseClient } from "./supabaseClient";

const WORKER_CANDIDATE_COLUMNS =
  "id, source_key, source_name, source_url, title, excerpt, body, category, published_at, scraped_at, status, attempt_count";

export type StoryCandidateStatus =
  | "pending"
  | "processing"
  | "processed"
  | "draft_created"
  | "failed"
  | "rejected"
  | "skipped_duplicate";

export interface StoryCandidateRow {
  source_key: string;
  source_name: string;
  source_url: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  published_at: string | null;
  scraped_at: string;
  raw_payload: unknown;
  status: "pending";
  ingestion_batch_id?: string | null;
  ingestion_run_id?: string | null;
}

export interface CandidateValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface InsertFailure {
  sourceUrl: string;
  reason: string;
}

export interface InsertStoryCandidatesResult {
  insertedCount: number;
  duplicateCount: number;
  failedCount: number;
  failed: InsertFailure[];
  insertedCandidates: NormalizedStoryCandidate[];
}

export interface InsertStoryCandidatesOptions {
  ingestionBatchId?: string | null;
  ingestionRunId?: string | null;
}

export function toStoryCandidateRow(
  candidate: NormalizedStoryCandidate,
  options?: InsertStoryCandidatesOptions
): StoryCandidateRow {
  return {
    source_key: candidate.sourceKey,
    source_name: candidate.sourceName,
    source_url: candidate.sourceUrl,
    title: candidate.title,
    excerpt: candidate.excerpt,
    body: candidate.body,
    category: candidate.category,
    published_at: candidate.publishedAt,
    scraped_at: candidate.scrapedAt,
    raw_payload: candidate.rawPayload,
    status: "pending",
    ingestion_batch_id: options?.ingestionBatchId ?? null,
    ingestion_run_id: options?.ingestionRunId ?? null,
  };
}

export function validateForInsert(
  candidate: NormalizedStoryCandidate
): CandidateValidationResult {
  const result = validateNormalizedCandidate(candidate);
  const reasons = [...result.reasons];

  if (!candidate.sourceName || candidate.sourceName.trim().length === 0) {
    reasons.push("missing sourceName");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export async function findExistingCandidateBySourceUrl(
  sourceUrl: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("story_candidates")
    .select("id")
    .eq("source_url", sourceUrl)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query existing candidate: ${error.message}`);
  }

  return Boolean(data?.id);
}

export interface StoryCandidateLookupRow {
  sourceUrl: string;
  existsInSupabase: boolean;
  status: StoryCandidateStatus | null;
  candidateId: string | null;
}

export async function lookupStoryCandidatesBySourceUrls(
  sourceUrls: string[]
): Promise<Record<string, StoryCandidateLookupRow>> {
  const result: Record<string, StoryCandidateLookupRow> = {};

  for (const sourceUrl of sourceUrls) {
    result[sourceUrl] = {
      sourceUrl,
      existsInSupabase: false,
      status: null,
      candidateId: null,
    };
  }

  if (sourceUrls.length === 0) {
    return result;
  }

  const supabase = getSupabaseClient();
  const batchSize = 500;

  for (let i = 0; i < sourceUrls.length; i += batchSize) {
    const batch = sourceUrls.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("story_candidates")
      .select("id, source_url, status")
      .in("source_url", batch);

    if (error) {
      throw new Error(`Failed to lookup story candidates: ${error.message}`);
    }

    for (const row of data ?? []) {
      const record = row as {
        id?: string;
        source_url?: string;
        status?: StoryCandidateStatus;
      };
      const sourceUrl = record.source_url;
      if (!sourceUrl) continue;

      result[sourceUrl] = {
        sourceUrl,
        existsInSupabase: true,
        status: record.status ?? null,
        candidateId: record.id ?? null,
      };
    }
  }

  return result;
}

export async function getExistingSourceUrls(
  sourceUrls: string[]
): Promise<Set<string>> {
  if (sourceUrls.length === 0) return new Set<string>();

  const supabase = getSupabaseClient();
  const existing = new Set<string>();
  const batchSize = 500;

  for (let i = 0; i < sourceUrls.length; i += batchSize) {
    const batch = sourceUrls.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("story_candidates")
      .select("source_url")
      .in("source_url", batch);

    if (error) {
      throw new Error(`Failed to query existing source URLs: ${error.message}`);
    }

    for (const row of data ?? []) {
      const value = (row as { source_url?: string }).source_url;
      if (typeof value === "string" && value.length > 0) {
        existing.add(value);
      }
    }
  }

  return existing;
}

export async function insertStoryCandidate(
  candidate: NormalizedStoryCandidate,
  options?: InsertStoryCandidatesOptions
): Promise<InsertStoryCandidatesResult> {
  return insertStoryCandidates([candidate], options);
}

export async function insertStoryCandidates(
  candidates: NormalizedStoryCandidate[],
  options?: InsertStoryCandidatesOptions
): Promise<InsertStoryCandidatesResult> {
  if (candidates.length === 0) {
    return {
      insertedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      failed: [],
      insertedCandidates: [],
    };
  }

  const sourceUrls = candidates.map((c) => c.sourceUrl);
  const existingBefore = await getExistingSourceUrls(sourceUrls);

  const rows = candidates.map((candidate) => toStoryCandidateRow(candidate, options));
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("story_candidates")
    .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true });

  if (error) {
    return {
      insertedCount: 0,
      duplicateCount: 0,
      failedCount: candidates.length,
      failed: candidates.map((c) => ({
        sourceUrl: c.sourceUrl,
        reason: error.message,
      })),
      insertedCandidates: [],
    };
  }

  const existingAfter = await getExistingSourceUrls(sourceUrls);
  let insertedCount = 0;
  let duplicateCount = 0;
  const insertedCandidates: NormalizedStoryCandidate[] = [];

  for (let index = 0; index < sourceUrls.length; index += 1) {
    const url = sourceUrls[index];
    const existed = existingBefore.has(url);
    const existsNow = existingAfter.has(url);

    if (!existed && existsNow) {
      insertedCount += 1;
      insertedCandidates.push(candidates[index]);
    } else {
      duplicateCount += 1;
    }
  }

  return {
    insertedCount,
    duplicateCount,
    failedCount: 0,
    failed: [],
    insertedCandidates,
  };
}

/**
 * Reads pending candidates for AI processing, oldest first.
 * Only returns rows with status='pending'; never touches other statuses.
 */
export async function getPendingCandidates(
  limit?: number | null,
  sourceKeys?: Set<string> | null,
  batchId?: string | null
): Promise<WorkerStoryCandidate[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("story_candidates")
    .select(WORKER_CANDIDATE_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (batchId) {
    query = query.eq("ingestion_batch_id", batchId);
  }

  if (sourceKeys && sourceKeys.size > 0) {
    query = query.in("source_key", Array.from(sourceKeys));
  }

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch pending candidates: ${error.message}`);
  }

  return (data ?? []) as unknown as WorkerStoryCandidate[];
}

/**
 * Atomically claims a candidate by moving pending -> processing and
 * incrementing attempt_count. The status='pending' filter is the race guard:
 * if another worker already claimed the row, no row is returned.
 */
export async function claimCandidateForProcessing(
  id: string,
  currentAttemptCount: number
): Promise<WorkerStoryCandidate | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("story_candidates")
    .update({
      status: "processing",
      attempt_count: currentAttemptCount + 1,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(WORKER_CANDIDATE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim candidate ${id}: ${error.message}`);
  }

  return (data as unknown as WorkerStoryCandidate) ?? null;
}

/**
 * Marks a claimed candidate as processed, writing only AI-related fields.
 * Never updates title/body/source fields or raw_payload.
 */
export async function markCandidateProcessed(
  id: string,
  processedPayload: ProcessedArticlePayload,
  openaiResponse: AiProviderMeta
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("story_candidates")
    .update({
      status: "processed",
      processed_payload: processedPayload,
      openai_response: openaiResponse,
      last_error: null,
    })
    .eq("id", id)
    .eq("status", "processing");

  if (error) {
    throw new Error(`Failed to mark candidate ${id} processed: ${error.message}`);
  }
}

/**
 * Records a processing failure. Stores last_error and sets status='failed'.
 */
export async function markCandidateFailed(
  id: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("story_candidates")
    .update({
      status: "failed",
      last_error: errorMessage.slice(0, 2000),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark candidate ${id} failed: ${error.message}`);
  }
}

export interface ResetStaleOptions {
  olderThanMinutes: number;
}

/**
 * Returns rows stuck in 'processing' back to 'pending' so they can be retried.
 * Useful after a crashed worker left candidates mid-flight.
 */
export async function resetStaleProcessingCandidates(
  options: ResetStaleOptions
): Promise<number> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(
    Date.now() - options.olderThanMinutes * 60_000
  ).toISOString();

  const { data, error } = await supabase
    .from("story_candidates")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    throw new Error(`Failed to reset stale candidates: ${error.message}`);
  }

  return (data ?? []).length;
}

const GUNNER_CANDIDATE_COLUMNS =
  "id, source_key, source_url, status, attempt_count, processed_payload, raw_payload, sanity_document_id";

/**
 * Row view of a `processed` story_candidate consumed by the Gunner Worker.
 * Imported lazily to avoid a hard dependency cycle with the gunnerWorker module.
 */
export interface ProcessedCandidateRow {
  id: string;
  source_key: string;
  source_url: string;
  status: StoryCandidateStatus;
  attempt_count: number;
  processed_payload: ProcessedArticlePayload | null;
  raw_payload: unknown;
  sanity_document_id: string | null;
  ingestion_batch_id?: string | null;
  ingestion_run_id?: string | null;
}

/**
 * Reads candidates ready for draft creation (status='processed'), oldest first.
 * Read-only: never mutates any row.
 */
export async function getProcessedCandidates(
  limit?: number | null,
  sourceKeys?: Set<string> | null,
  batchId?: string | null
): Promise<ProcessedCandidateRow[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("story_candidates")
    .select(GUNNER_CANDIDATE_COLUMNS)
    .eq("status", "processed")
    .order("updated_at", { ascending: true });

  if (batchId) {
    query = query.eq("ingestion_batch_id", batchId);
  }

  if (sourceKeys && sourceKeys.size > 0) {
    query = query.in("source_key", Array.from(sourceKeys));
  }

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch processed candidates: ${error.message}`);
  }

  return (data ?? []) as unknown as ProcessedCandidateRow[];
}

/**
 * Fetches a single candidate by id (Gunner column projection).
 */
export async function lookupCandidateById(
  id: string
): Promise<ProcessedCandidateRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("story_candidates")
    .select(GUNNER_CANDIDATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to lookup candidate ${id}: ${error.message}`);
  }

  return (data as unknown as ProcessedCandidateRow) ?? null;
}

/**
 * Transitions a candidate processed -> draft_created, recording the Sanity
 * draft id. Status-guarded (.eq('status','processed')) so it never clobbers a
 * row that moved on. Never touches processed_payload/raw_payload/source fields.
 */
export async function markCandidateDraftCreated(
  id: string,
  sanityDocumentId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("story_candidates")
    .update({
      status: "draft_created",
      sanity_document_id: sanityDocumentId,
      last_error: null,
    })
    .eq("id", id)
    .eq("status", "processed");

  if (error) {
    throw new Error(`Failed to mark candidate ${id} draft_created: ${error.message}`);
  }
}

/**
 * Records a Gunner draft-creation failure without changing status. The
 * candidate stays 'processed' so it can be retried on a later run.
 */
export async function markCandidateGunnerFailed(
  id: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("story_candidates")
    .update({
      last_error: errorMessage.slice(0, 2000),
    })
    .eq("id", id)
    .eq("status", "processed");

  if (error) {
    throw new Error(`Failed to record gunner failure for ${id}: ${error.message}`);
  }
}

export interface BatchCandidateStatusCounts {
  pending: number;
  processing: number;
  processed: number;
  draft_created: number;
  failed: number;
}

export async function getBatchCandidateStatusCounts(
  batchId: string
): Promise<BatchCandidateStatusCounts> {
  const supabase = getSupabaseClient();
  const statuses: Array<keyof BatchCandidateStatusCounts> = [
    "pending",
    "processing",
    "processed",
    "draft_created",
    "failed",
  ];

  const result: BatchCandidateStatusCounts = {
    pending: 0,
    processing: 0,
    processed: 0,
    draft_created: 0,
    failed: 0,
  };

  for (const status of statuses) {
    const { count, error } = await supabase
      .from("story_candidates")
      .select("id", { count: "exact", head: true })
      .eq("ingestion_batch_id", batchId)
      .eq("status", status);

    if (error) {
      throw new Error(`Failed to count ${status} candidates for batch ${batchId}: ${error.message}`);
    }
    result[status] = count ?? 0;
  }

  return result;
}
