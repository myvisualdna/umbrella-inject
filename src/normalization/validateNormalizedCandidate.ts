import { getSourceMetadata } from "./sourceMetadata";
import type { NormalizedStoryCandidate } from "./types";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateNormalizedCandidate(candidate: NormalizedStoryCandidate): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (candidate.success !== true) {
    reasons.push("success is not true");
  }

  if (!candidate.sourceKey) {
    reasons.push("missing sourceKey");
  } else if (!getSourceMetadata(candidate.sourceKey)) {
    reasons.push("unknown sourceKey");
  }

  if (!isValidHttpUrl(candidate.sourceUrl)) {
    reasons.push("invalid sourceUrl");
  }

  if (!candidate.title || candidate.title.trim().length < 4) {
    reasons.push("title shorter than 4 characters");
  }

  if (!candidate.body || candidate.body.trim().length === 0) {
    reasons.push("missing body");
  } else if (countWords(candidate.body) < 150) {
    reasons.push("body shorter than 150 words");
  }

  if (!candidate.category || candidate.category.trim().length === 0) {
    reasons.push("missing category");
  }

  if (!candidate.scrapedAt || candidate.scrapedAt.trim().length === 0) {
    reasons.push("missing scrapedAt");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
