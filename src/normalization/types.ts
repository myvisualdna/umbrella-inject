import type { SourceKey } from "../config/scrapingControl";
import type { ReadinessStatus } from "../scripts/auditScrapeManifest";

export type NormalizedStoryCandidate = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  publishedAt: string | null;
  scrapedAt: string;
  rawPayload: unknown;
  success: boolean;
  error: string | null;
};

export interface RawScrapedArticle {
  url?: string;
  title?: string;
  excerpt?: string | null;
  body?: string;
  category?: string | null;
  publishedAt?: string | null;
  scrapedAt?: string;
  sourceKey?: string;
  source?: string;
  success?: boolean;
  error?: string | null;
  [key: string]: unknown;
}

export interface SourceMetadata {
  sourceKey: SourceKey;
  sourceName: string;
  publisher: string;
  defaultCategory: string;
  readiness: ReadinessStatus;
  requiresLegalReview: boolean;
}

export interface RejectedCandidate {
  candidate: NormalizedStoryCandidate;
  reasons: string[];
}

export interface DuplicateCandidateRecord {
  canonicalUrl: string;
  sourceUrl: string;
  sourceKey: string;
  keptSourceKey: string;
}

export interface SourceNormalizationSummary {
  sourceKey: string;
  sourceName: string;
  rawArticles: number;
  validCandidates: number;
  rejectedCandidates: number;
}

export interface NormalizationSummary {
  generatedAt: string;
  inputDirectory: string;
  outputDirectory: string;
  filesRead: number;
  sourcesProcessed: number;
  rawArticlesRead: number;
  validCandidates: number;
  rejectedCandidates: number;
  duplicatesRemoved: number;
  legalReviewCounts: {
    requiresLegalReview: number;
    noLegalReview: number;
  };
  rejectionReasonCounts: Record<string, number>;
  perSource: SourceNormalizationSummary[];
  duplicates: DuplicateCandidateRecord[];
}
