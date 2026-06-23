export type SlackPipelineStage = "fetcher" | "ai" | "gunner" | "pipeline";

export type SlackFetcherSummary = {
  runId: string;
  batchId: string | null;
  insertedCount: number;
  skippedCount?: number;
  failedCount?: number;
  sourceCount?: number;
  dryRun: boolean;
};

export type SlackAiSummary = {
  runId: string;
  batchId: string | null;
  expectedCount?: number;
  processedCount: number;
  failedCount?: number;
  provider: string;
  dryRun: boolean;
};

export type SlackGunnerDraftLink = {
  title: string;
  sanityId: string;
  studioUrl?: string;
};

export type SlackGunnerSummary = {
  runId: string;
  batchId: string | null;
  expectedCount?: number;
  draftCount: number;
  failedCount?: number;
  dryRun: boolean;
  draftLinks?: SlackGunnerDraftLink[];
};

export type SlackFailureAlert = {
  stage: SlackPipelineStage;
  runId?: string;
  batchId?: string | null;
  message: string;
  details?: string[];
};

export type SlackWebhookPayload = {
  text: string;
  blocks?: unknown[];
};

export type SlackMessageContext = {
  channelName?: string;
  githubRunUrl?: string;
};
