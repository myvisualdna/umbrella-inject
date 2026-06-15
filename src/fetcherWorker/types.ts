import type { RunConfig, SourceKey } from "../config/scrapingControl";
import type { NormalizedStoryCandidate } from "../normalization/types";

export interface FetcherRunOptions {
  dryRun: boolean;
  writeEnabled: boolean;
  sourceKeysFilter: Set<SourceKey> | null;
  maxTotalArticles: number | null;
}

export interface FetcherSourceSelection {
  source: SourceKey;
  count: number;
}

export interface FetcherRejectedCandidate {
  sourceUrl: string;
  sourceKey: string;
  reasons: string[];
}

export interface FetcherRunResult {
  runId: RunConfig["id"];
  runLabel: string;
  dryRun: boolean;
  writeEnabled: boolean;
  sourcesSelected: FetcherSourceSelection[];
  plannedTotalArticles: number;
  scrapedArticlesCount: number;
  normalizedValidCount: number;
  rejectedCount: number;
  duplicateCount: number;
  candidatesInserted: number;
  supabaseUpdated: boolean;
  openAiCalled: false;
  sanityCalled: false;
  legacyMiddlewareCalled: false;
  legacyGunnerCalled: false;
  reportPaths: {
    summaryJson: string;
    markdownAudit: string;
  };
  normalizedValidCandidates: NormalizedStoryCandidate[];
  rejectedCandidates: FetcherRejectedCandidate[];
}
