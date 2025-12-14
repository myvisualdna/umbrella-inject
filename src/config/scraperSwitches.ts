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
  apNewsUS: false, // AP News US scraping disabled
  apNewsWorld: true, // AP News World scraping disabled
  apNewsPolitics: false, // AP News Politics scraping disabled
  apNewsBusiness: false, // AP News Business scraping disabled
  apNewsScience: false, // AP News Science scraping disabled
  apNewsTechnology: false, // AP News Technology scraping disabled
  apNewsLifestyle: false, // AP News Lifestyle scraping disabled
  apNewsEntertainment: false, // AP News Entertainment scraping disabled
  yahooUSNews: false, // Yahoo US News scraping disabled
  yahooWorldNews: true, // Yahoo World News scraping disabled
  yahooPoliticsNews: false, // Yahoo Politics News scraping disabled
  yahooFinanceNews: false, // Yahoo Finance News scraping disabled
  yahooEntertainmentNews: false, // Yahoo Entertainment News scraping disabled
  yahooLifestyleNews: false, // Yahoo Lifestyle News scraping disabled
  yahooScienceNews: false, // Yahoo Science News scraping disabled
  cbsUS: false, // CBS US scraping enabled
  cbsWorld: false, // CBS World scraping enabled
  cbsPolitics: false, // CBS Politics scraping enabled
  techCrunch: false, // TechCrunch scraping enabled
  abcNewsUS: false, // ABC News US scraping disabled
  abcNewsInternational: false, // ABC News International scraping disabled
  abcNewsBusiness: false, // ABC News Business scraping disabled
  abcNewsTechnology: false, // ABC News Technology scraping disabled
};

/**
 * Check if a scraper is enabled
 */
export function isScraperEnabled(source: keyof ScraperSwitches): boolean {
  return scraperSwitches[source] === true;
}

