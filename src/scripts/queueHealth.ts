/**
 * Read-only queue and batch health report.
 * No writes. No secrets printed.
 */
import { getSupabaseClient, hasSupabaseEnv } from "../db/supabaseClient";
import type { StoryCandidateStatus } from "../db/storyCandidates";

const STATUSES: StoryCandidateStatus[] = [
  "pending",
  "processing",
  "processed",
  "draft_created",
  "failed",
  "rejected",
  "skipped_duplicate",
];

function getSupabaseHost(): string | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function formatAge(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const ageMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function isBatchTableMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("story_candidate_batches") &&
      (lower.includes("does not exist") || lower.includes("could not find"))) ||
    lower.includes("schema cache")
  );
}

async function countByStatus(status: StoryCandidateStatus): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("story_candidates")
    .select("id", { head: true, count: "exact" })
    .eq("status", status);

  if (error) {
    throw new Error(`Failed to count status=${status}: ${error.message}`);
  }
  return count ?? 0;
}

async function getOldestPendingAge(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("story_candidates")
    .select("created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch oldest pending candidate: ${error.message}`);
  }

  return formatAge((data as { created_at?: string } | null)?.created_at);
}

async function getRecentFailedRows(limit = 10): Promise<
  Array<{
    id: string;
    source_key: string;
    status: string;
    last_error: string | null;
    ingestion_batch_id: string | null;
  }>
> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("story_candidates")
    .select("id, source_key, status, last_error, ingestion_batch_id")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.toLowerCase().includes("ingestion_batch_id")) {
      const fallback = await supabase
        .from("story_candidates")
        .select("id, source_key, status, last_error")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (fallback.error) {
        throw new Error(`Failed to fetch recent failed rows: ${fallback.error.message}`);
      }
      return (fallback.data ?? []).map((row) => ({
        ...(row as {
          id: string;
          source_key: string;
          status: string;
          last_error: string | null;
        }),
        ingestion_batch_id: null,
      }));
    }
    throw new Error(`Failed to fetch recent failed rows: ${error.message}`);
  }

  return (data ?? []) as Array<{
    id: string;
    source_key: string;
    status: string;
    last_error: string | null;
    ingestion_batch_id: string | null;
  }>;
}

async function getBatchSummaries(): Promise<{
  available: boolean;
  warning: string | null;
  byStatus: Record<string, number>;
  latest: unknown | null;
}> {
  const supabase = getSupabaseClient();
  const { data: latest, error: latestError } = await supabase
    .from("story_candidate_batches")
    .select("id, run_id, run_label, status, inserted_count, ai_processed_count, gunner_drafted_count, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    if (isBatchTableMissing(latestError.message)) {
      return {
        available: false,
        warning: "Batch table unavailable; apply migration 20260615_story_candidate_batches.sql",
        byStatus: {},
        latest: null,
      };
    }
    throw new Error(`Failed to fetch latest batch: ${latestError.message}`);
  }

  const statuses = [
    "fetching",
    "fetched",
    "ai_processing",
    "ai_completed",
    "drafting",
    "completed",
    "failed",
  ];
  const byStatus: Record<string, number> = {};
  for (const status of statuses) {
    const { count, error } = await supabase
      .from("story_candidate_batches")
      .select("id", { head: true, count: "exact" })
      .eq("status", status);
    if (error) {
      throw new Error(`Failed to count batch status=${status}: ${error.message}`);
    }
    byStatus[status] = count ?? 0;
  }

  return {
    available: true,
    warning: null,
    byStatus,
    latest,
  };
}

async function main(): Promise<void> {
  console.log("queueHealth: read-only report");
  console.log(`Supabase host: ${getSupabaseHost() ?? "not configured"}`);

  if (!hasSupabaseEnv()) {
    console.error("Missing Supabase environment (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const status of STATUSES) {
    const count = await countByStatus(status);
    statusCounts[status] = count;
    total += count;
  }

  const oldestPendingAge = await getOldestPendingAge();
  const recentFailed = await getRecentFailedRows(10);
  const batchSummary = await getBatchSummaries();

  const report = {
    generatedAt: new Date().toISOString(),
    supabaseHost: getSupabaseHost(),
    candidateTotals: {
      total,
      byStatus: statusCounts,
      pending: statusCounts.pending,
      processing: statusCounts.processing,
      processed: statusCounts.processed,
      draft_created: statusCounts.draft_created,
      failed: statusCounts.failed,
      rejected: statusCounts.rejected,
      skipped_duplicate: statusCounts.skipped_duplicate,
    },
    oldestPendingAge,
    batch: batchSummary,
    recentFailed,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`queueHealth: FAIL - ${message}`);
  process.exit(1);
});
