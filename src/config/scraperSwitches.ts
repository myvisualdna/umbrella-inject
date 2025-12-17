/**
 * Source scraper activation switches
 * Set to true to enable scraping for a source, false to disable
 */
export interface ScraperSwitches {
  apNewsUS: boolean;
  apNewsWorld: boolean;
  apNewsPolitics: boolean;
  apNewsBusiness: boolean;
  apNewsScience: boolean;
  apNewsTechnology: boolean;
  apNewsLifestyle: boolean;
  apNewsEntertainment: boolean;
  yahooUSNews: boolean;
  yahooWorldNews: boolean;
  yahooPoliticsNews: boolean;
  yahooFinanceNews: boolean;
  yahooEntertainmentNews: boolean;
  yahooLifestyleNews: boolean;
  yahooScienceNews: boolean;
  cbsUS: boolean;
  cbsWorld: boolean;
  cbsPolitics: boolean;
  techCrunch: boolean;
  abcNewsUS: boolean;
  abcNewsInternational: boolean;
  abcNewsBusiness: boolean;
  abcNewsTechnology: boolean;
}

/**
 * Default scraper switches configuration
 * Modify these values to enable/disable scrapers
 */
export const scraperSwitches: ScraperSwitches = {
  apNewsUS: true, // AP News US scraping disabled
  apNewsWorld: true, // AP News World scraping disabled
  apNewsPolitics: true, // AP News Politics scraping disabled
  apNewsBusiness: true, // AP News Business scraping disabled
  apNewsScience: true, // AP News Science scraping disabled
  apNewsTechnology: true, // AP News Technology scraping disabled
  apNewsLifestyle: true, // AP News Lifestyle scraping disabled
  apNewsEntertainment: true, // AP News Entertainment scraping disabled
  yahooUSNews: true, // Yahoo US News scraping disabled
  yahooWorldNews: true, // Yahoo World News scraping disabled
  yahooPoliticsNews: true, // Yahoo Politics News scraping disabled
  yahooFinanceNews: true, // Yahoo Finance News scraping disabled
  yahooEntertainmentNews: true, // Yahoo Entertainment News scraping disabled
  yahooLifestyleNews: true, // Yahoo Lifestyle News scraping disabled
  yahooScienceNews: true, // Yahoo Science News scraping disabled
  cbsUS: true, // CBS US scraping enabled
  cbsWorld: true, // CBS World scraping enabled
  cbsPolitics: true, // CBS Politics scraping enabled
  techCrunch: true, // TechCrunch scraping enabled
  abcNewsUS: true, // ABC News US scraping disabled
  abcNewsInternational: true, // ABC News International scraping disabled
  abcNewsBusiness: true, // ABC News Business scraping disabled
  abcNewsTechnology: true, // ABC News Technology scraping disabled
};

/**
 * Check if a scraper is enabled
 */
export function isScraperEnabled(source: keyof ScraperSwitches): boolean {
  return scraperSwitches[source] === true;
}

