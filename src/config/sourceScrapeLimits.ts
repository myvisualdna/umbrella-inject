import type { SourceKey } from "./scrapingControl";

/**
 * Default article count per source when a scraper wrapper is invoked without an
 * explicit limit. Mirrors the `limit = N` defaults in src/scrapers/*.
 */
export const SOURCE_SCRAPE_LIMITS: Record<SourceKey, number> = {
  apNewsUS: 5,
  apNewsWorld: 5,
  apNewsPolitics: 4,
  apNewsBusiness: 5,
  apNewsScience: 5,
  apNewsTechnology: 5,
  apNewsLifestyle: 5,
  apNewsEntertainment: 5,
  yahooUSNews: 4,
  yahooWorldNews: 4,
  yahooPoliticsNews: 7,
  yahooFinanceNews: 4,
  yahooEntertainmentNews: 5,
  yahooLifestyleNews: 5,
  yahooScienceNews: 5,
  cbsUS: 5,
  cbsWorld: 5,
  cbsPolitics: 5,
  techCrunch: 5,
  abcNewsUS: 5,
  abcNewsInternational: 5,
  abcNewsBusiness: 5,
  abcNewsTechnology: 5,
};

export function getSourceScrapeLimit(sourceKey: SourceKey): number {
  return SOURCE_SCRAPE_LIMITS[sourceKey];
}
