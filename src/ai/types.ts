import type { StoryCandidateStatus } from "../db/storyCandidates";

export type ProcessedArticleContentType =
  | "news"
  | "analysis_candidate"
  | "opinion_candidate";

export interface ProcessedArticlePayload {
  title: string;
  tickerTitle: string;
  excerpt: string;
  body: string[];
  category: string;
  /** Canonical AI output for tag selection: Sanity tag slugs only. */
  tagSlugs: string[];
  /**
   * Legacy compatibility field from older processed rows.
   * New providers should not emit this field.
   */
  tags?: string[];
  seo: {
    title: string;
    description: string;
  };
  classification: {
    importanceScore: number;
    breakingNewsScore: number;
    contentType: ProcessedArticleContentType;
    confidence: number;
  };
  sourceAttribution: {
    sourceName: string;
    sourceUrl: string;
    publishedAt: string | null;
  };
  editorialNotes: {
    summary: string;
    keyFacts: string[];
    riskFlags: string[];
    humanReviewRequired: boolean;
  };
}

/**
 * Row view of a story_candidate as consumed by the AI worker.
 * Mirrors the Supabase columns the worker reads; never used to overwrite
 * source fields.
 */
export interface WorkerStoryCandidate {
  id: string;
  source_key: string;
  source_name: string;
  source_url: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  published_at: string | null;
  scraped_at: string;
  status: StoryCandidateStatus;
  attempt_count: number;
}

export type AiProviderName = "mock" | "openai";

/**
 * Provider metadata persisted to the `openai_response` column.
 * MUST never contain the API key.
 */
export interface AiProviderMeta {
  provider: AiProviderName;
  model: string | null;
  createdAt: string;
  durationMs: number;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  raw: unknown | null;
}

export interface AiProviderResult {
  payload: ProcessedArticlePayload;
  meta: AiProviderMeta;
}

export interface AiArticleProvider {
  readonly name: AiProviderName;
  generateArticleDraft(candidate: WorkerStoryCandidate): Promise<AiProviderResult>;
}
