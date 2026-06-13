import type { SourceKey } from "../config/scrapingControl";
import type { SourceMetadata } from "./types";

export const SOURCE_METADATA: Record<SourceKey, SourceMetadata> = {
  apNewsUS: {
    sourceKey: "apNewsUS",
    sourceName: "AP News US",
    publisher: "Associated Press",
    defaultCategory: "us",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsWorld: {
    sourceKey: "apNewsWorld",
    sourceName: "AP News World",
    publisher: "Associated Press",
    defaultCategory: "world",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsPolitics: {
    sourceKey: "apNewsPolitics",
    sourceName: "AP News Politics",
    publisher: "Associated Press",
    defaultCategory: "politics",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsBusiness: {
    sourceKey: "apNewsBusiness",
    sourceName: "AP News Business",
    publisher: "Associated Press",
    defaultCategory: "business",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsScience: {
    sourceKey: "apNewsScience",
    sourceName: "AP News Science",
    publisher: "Associated Press",
    defaultCategory: "science",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsTechnology: {
    sourceKey: "apNewsTechnology",
    sourceName: "AP News Technology",
    publisher: "Associated Press",
    defaultCategory: "technology",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsLifestyle: {
    sourceKey: "apNewsLifestyle",
    sourceName: "AP News Lifestyle",
    publisher: "Associated Press",
    defaultCategory: "lifestyle",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  apNewsEntertainment: {
    sourceKey: "apNewsEntertainment",
    sourceName: "AP News Entertainment",
    publisher: "Associated Press",
    defaultCategory: "entertainment",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooUSNews: {
    sourceKey: "yahooUSNews",
    sourceName: "Yahoo News US",
    publisher: "Yahoo News",
    defaultCategory: "us",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooWorldNews: {
    sourceKey: "yahooWorldNews",
    sourceName: "Yahoo News World",
    publisher: "Yahoo News",
    defaultCategory: "world",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooPoliticsNews: {
    sourceKey: "yahooPoliticsNews",
    sourceName: "Yahoo News Politics",
    publisher: "Yahoo News",
    defaultCategory: "politics",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooFinanceNews: {
    sourceKey: "yahooFinanceNews",
    sourceName: "Yahoo Finance",
    publisher: "Yahoo Finance",
    defaultCategory: "business",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooEntertainmentNews: {
    sourceKey: "yahooEntertainmentNews",
    sourceName: "Yahoo Entertainment",
    publisher: "Yahoo News",
    defaultCategory: "entertainment",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooLifestyleNews: {
    sourceKey: "yahooLifestyleNews",
    sourceName: "Yahoo Lifestyle",
    publisher: "Yahoo News",
    defaultCategory: "lifestyle",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  yahooScienceNews: {
    sourceKey: "yahooScienceNews",
    sourceName: "Yahoo Science",
    publisher: "Yahoo News",
    defaultCategory: "science",
    readiness: "needs minor fixes",
    requiresLegalReview: true,
  },
  cbsUS: {
    sourceKey: "cbsUS",
    sourceName: "CBS News US",
    publisher: "CBS News",
    defaultCategory: "us",
    readiness: "ready",
    requiresLegalReview: false,
  },
  cbsWorld: {
    sourceKey: "cbsWorld",
    sourceName: "CBS News World",
    publisher: "CBS News",
    defaultCategory: "world",
    readiness: "ready",
    requiresLegalReview: false,
  },
  cbsPolitics: {
    sourceKey: "cbsPolitics",
    sourceName: "CBS News Politics",
    publisher: "CBS News",
    defaultCategory: "politics",
    readiness: "ready",
    requiresLegalReview: false,
  },
  techCrunch: {
    sourceKey: "techCrunch",
    sourceName: "TechCrunch",
    publisher: "TechCrunch",
    defaultCategory: "tech",
    readiness: "ready",
    requiresLegalReview: false,
  },
  abcNewsUS: {
    sourceKey: "abcNewsUS",
    sourceName: "ABC News US",
    publisher: "ABC News",
    defaultCategory: "us",
    readiness: "ready",
    requiresLegalReview: false,
  },
  abcNewsInternational: {
    sourceKey: "abcNewsInternational",
    sourceName: "ABC News International",
    publisher: "ABC News",
    defaultCategory: "international",
    readiness: "ready",
    requiresLegalReview: false,
  },
  abcNewsBusiness: {
    sourceKey: "abcNewsBusiness",
    sourceName: "ABC News Business",
    publisher: "ABC News",
    defaultCategory: "business",
    readiness: "ready",
    requiresLegalReview: false,
  },
  abcNewsTechnology: {
    sourceKey: "abcNewsTechnology",
    sourceName: "ABC News Technology",
    publisher: "ABC News",
    defaultCategory: "technology",
    readiness: "ready",
    requiresLegalReview: false,
  },
};

const SOURCE_KEY_ALIASES: Record<string, SourceKey> = {
  yahooNewsUS: "yahooUSNews",
  yahooNewsWorld: "yahooWorldNews",
  yahooNewsPolitics: "yahooPoliticsNews",
};

export function resolveSourceKey(sourceKey: string): SourceKey | undefined {
  if ((sourceKey as SourceKey) in SOURCE_METADATA) {
    return sourceKey as SourceKey;
  }
  return SOURCE_KEY_ALIASES[sourceKey];
}

export function getSourceMetadata(sourceKey: string): SourceMetadata | undefined {
  const resolved = resolveSourceKey(sourceKey);
  if (!resolved) return undefined;
  return SOURCE_METADATA[resolved];
}
