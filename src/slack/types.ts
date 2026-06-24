export type SlackPipelineStage = "fetcher" | "ai" | "gunner" | "pipeline";

export type SlackFetcherInsertedArticle = {
  title: string;
  sourceKey?: string;
  sourceName?: string;
  sourceUrl?: string;
  category?: string;
};

export type SlackFetcherSummary = {
  runId: string;
  batchId: string | null;
  insertedCount: number;
  skippedCount?: number;
  failedCount?: number;
  sourceCount?: number;
  dryRun: boolean;
  insertedArticles?: SlackFetcherInsertedArticle[];
  sourceBreakdown?: string;
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

export type SlackStoryCandidateNotification = {
  id?: string;
  source_key: string;
  source_name: string;
  source_url: string;
  title: string;
  excerpt?: string | null;
  body: string;
  category: string;
  published_at?: string | null;
  scraped_at?: string;
  status?: string;
  attempt_count?: number;
  last_error?: string | null;
  sanity_document_id?: string | null;
  created_at?: string;
  updated_at?: string;
  ingestion_batch_id?: string | null;
  ingestion_run_id?: string | null;
};
