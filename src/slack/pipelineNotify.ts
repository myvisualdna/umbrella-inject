import { logger } from "../config/logger";
import type { FetcherRunResult } from "../fetcherWorker/types";
import type { GunnerDraftPreviewEntry } from "../gunnerWorker/types";
import { getSlackConfigFromEnv } from "./config";
import { buildSanityStudioUrl } from "./messages";
import { notifyAiSummary, notifyFailure, notifyFetcherSummary, notifyGunnerSummary } from "./notify";
import type { SlackFailureAlert, SlackGunnerDraftLink } from "./types";

function formatNotifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveRunIdForSlack(): string {
  return process.env.GITHUB_RUN_ID?.trim() || "—";
}

export async function notifyFetcherRunComplete(result: FetcherRunResult): Promise<void> {
  try {
    await notifyFetcherSummary({
      runId: result.runId,
      batchId: result.batchId,
      insertedCount: result.insertedCount,
      skippedCount: result.duplicateCount,
      failedCount: result.rejectedCount,
      sourceCount: result.sourcesSelected.length,
      dryRun: result.dryRun,
    });
  } catch (error) {
    logger.warn("Slack fetcher notification failed", { error: formatNotifyError(error) });
  }
}

interface AiWorkerSummary {
  batchId: string | null;
  expectedCount: number | null;
  processedCount: number;
  failedCount: number;
  provider: string;
  dryRun: boolean;
}

export async function notifyAiRunComplete(summary: AiWorkerSummary): Promise<void> {
  try {
    await notifyAiSummary({
      runId: resolveRunIdForSlack(),
      batchId: summary.batchId,
      expectedCount: summary.expectedCount ?? undefined,
      processedCount: summary.processedCount,
      failedCount: summary.failedCount,
      provider: summary.provider,
      dryRun: summary.dryRun,
    });
  } catch (error) {
    logger.warn("Slack AI notification failed", { error: formatNotifyError(error) });
  }
}

interface GunnerWorkerSummary {
  batchId: string | null;
  expectedCount: number | null;
  draftedCount: number;
  failedCount: number;
  dryRun: boolean;
  outcomes: Array<{
    candidateId: string;
    drafted: boolean;
    sanityDocumentId: string | null;
  }>;
}

function buildGunnerDraftLinks(
  summary: GunnerWorkerSummary,
  previews: GunnerDraftPreviewEntry[]
): SlackGunnerDraftLink[] {
  const config = getSlackConfigFromEnv();
  const previewByCandidateId = new Map(
    previews.map((preview) => [preview.candidateId, preview])
  );

  return summary.outcomes
    .filter((outcome) => outcome.drafted && outcome.sanityDocumentId)
    .slice(0, 5)
    .map((outcome) => {
      const preview = previewByCandidateId.get(outcome.candidateId);
      const title = preview?.draft.title?.trim() || outcome.sanityDocumentId!;
      const sanityId = outcome.sanityDocumentId!;
      return {
        title,
        sanityId,
        studioUrl: buildSanityStudioUrl(sanityId, config.studioBaseUrl),
      };
    });
}

export async function notifyGunnerRunComplete(
  summary: GunnerWorkerSummary,
  previews: GunnerDraftPreviewEntry[]
): Promise<void> {
  try {
    await notifyGunnerSummary({
      runId: resolveRunIdForSlack(),
      batchId: summary.batchId,
      expectedCount: summary.expectedCount ?? undefined,
      draftCount: summary.draftedCount,
      failedCount: summary.failedCount,
      dryRun: summary.dryRun,
      draftLinks: buildGunnerDraftLinks(summary, previews),
    });
  } catch (error) {
    logger.warn("Slack Gunner notification failed", { error: formatNotifyError(error) });
  }
}

export async function notifyStageFailure(alert: SlackFailureAlert): Promise<void> {
  try {
    await notifyFailure(alert);
  } catch (error) {
    logger.warn("Slack failure notification failed", { error: formatNotifyError(error) });
  }
}
