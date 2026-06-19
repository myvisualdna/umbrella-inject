import { logger } from "../config/logger";
import { isScraperEnabled } from "../config/scraperSwitches";
import type { SourceKey } from "../config/scrapingControl";
import { getLatestArticlesFromSource } from "../utils/scraperUtils";

// AP News scrapers
import { scrapeAPNews } from "../scrapers/apnews/us";
import { scrapeAPNewsWorld } from "../scrapers/apnews/world";
import { scrapeAPNewsPolitics } from "../scrapers/apnews/politics";
import { scrapeAPNewsBusiness } from "../scrapers/apnews/business";
import { scrapeAPNewsScience } from "../scrapers/apnews/science";
import { scrapeAPNewsTechnology } from "../scrapers/apnews/technology";
import { scrapeAPNewsLifestyle } from "../scrapers/apnews/lifestyle";
import { scrapeAPNewsEntertainment } from "../scrapers/apnews/entertainment";

// Yahoo News scrapers
import { scrapeYahooNewsUS } from "../scrapers/yahoo/us";
import { scrapeYahooNewsWorld } from "../scrapers/yahoo/world";
import { scrapeYahooNewsPolitics } from "../scrapers/yahoo/politics";
import { scrapeYahooNewsFinance } from "../scrapers/yahoo/finance";
import { scrapeYahooNewsEntertainment } from "../scrapers/yahoo/entertainment";
import { scrapeYahooNewsLifestyle } from "../scrapers/yahoo/lifestyle";
import { scrapeYahooNewsScience } from "../scrapers/yahoo/science";

// CBS News scrapers
import { scrapeCBSUS } from "../scrapers/cbs/us";
import { scrapeCBSWorld } from "../scrapers/cbs/world";
import { scrapeCBSPolitics } from "../scrapers/cbs/politics";

// TechCrunch scraper
import { scrapeTechCrunch } from "../scrapers/techcrunch/index";

// ABC News scrapers
import { scrapeABCNewsUS } from "../scrapers/abcnews/us";
import { scrapeABCNewsInternational } from "../scrapers/abcnews/world";
import { scrapeABCNewsBusiness } from "../scrapers/abcnews/business";
import { scrapeABCNewsTechnology } from "../scrapers/abcnews/technology";

/**
 * Dispatches scraping requests to the appropriate scraper function
 * @param source - The source key from ScraperSwitches
 * @param count - Number of articles to scrape
 * @param options.skipEnabledCheck - When true, run even if scraper switch is off (audit use)
 */
export async function runSourceScraper(
  source: SourceKey,
  count: number,
  options?: { skipEnabledCheck?: boolean }
): Promise<void> {
  if (!options?.skipEnabledCheck && !isScraperEnabled(source)) {
    return;
  }
  await scrapeSourceImpl(source, count);
}

/**
 * Reads the latest scraped articles array for a source from results/
 */
export function readScrapedArticles(source: SourceKey): any[] {
  return getLatestArticlesFromSource(source);
}

async function scrapeSourceImpl(source: SourceKey, count: number): Promise<void> {
  try {
    switch (source) {
      // AP News sources
      case "apNewsUS":
        await scrapeAPNews(count);
        break;
      case "apNewsWorld":
        await scrapeAPNewsWorld(count);
        break;
      case "apNewsPolitics":
        await scrapeAPNewsPolitics(count);
        break;
      case "apNewsBusiness":
        await scrapeAPNewsBusiness(count);
        break;
      case "apNewsScience":
        await scrapeAPNewsScience(count);
        break;
      case "apNewsTechnology":
        await scrapeAPNewsTechnology(count);
        break;
      case "apNewsLifestyle":
        await scrapeAPNewsLifestyle(count);
        break;
      case "apNewsEntertainment":
        await scrapeAPNewsEntertainment(count);
        break;

      // Yahoo News sources
      case "yahooUSNews":
        await scrapeYahooNewsUS(count);
        break;
      case "yahooWorldNews":
        await scrapeYahooNewsWorld(count);
        break;
      case "yahooPoliticsNews":
        await scrapeYahooNewsPolitics(count);
        break;
      case "yahooFinanceNews":
        await scrapeYahooNewsFinance(count);
        break;
      case "yahooEntertainmentNews":
        await scrapeYahooNewsEntertainment(count);
        break;
      case "yahooLifestyleNews":
        await scrapeYahooNewsLifestyle(count);
        break;
      case "yahooScienceNews":
        await scrapeYahooNewsScience(count);
        break;

      // CBS News sources
      case "cbsUS":
        await scrapeCBSUS(count);
        break;
      case "cbsWorld":
        await scrapeCBSWorld(count);
        break;
      case "cbsPolitics":
        await scrapeCBSPolitics(count);
        break;

      // TechCrunch
      case "techCrunch":
        await scrapeTechCrunch(count);
        break;

      // ABC News sources
      case "abcNewsUS":
        await scrapeABCNewsUS(count);
        break;
      case "abcNewsInternational":
        await scrapeABCNewsInternational(count);
        break;
      case "abcNewsBusiness":
        await scrapeABCNewsBusiness(count);
        break;
      case "abcNewsTechnology":
        await scrapeABCNewsTechnology(count);
        break;

      default:
        logger.warn(`⚠️  No scraper implemented for source: ${source}`);
    }
  } catch (error) {
    logger.error(`❌ Error scraping ${source}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
