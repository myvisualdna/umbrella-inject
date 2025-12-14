import { logger } from "../config/logger";
import { isScraperEnabled } from "../config/scraperSwitches";
import { SCRAPING_RUNS, type RunConfig, type SourceKey, isRunEnabled } from "../config/scrapingControl";
import {
  getLatestArticlesFromSource,
  saveCollectedArticles,
} from "../utils/scraperUtils";
import { processCollectedArticlesFromRun } from "../middleware/chatgptMiddleware";
import { sendProcessedArticlesToSanity } from "../gunner";

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
 * Formats source name for display (removes common suffixes for cleaner output)
 */
function formatSourceName(source: SourceKey): string {
  // Map source keys to cleaner display names
  const nameMap: Record<string, string> = {
    apNewsUS: "apNews",
    apNewsWorld: "apNewsWorld",
    apNewsPolitics: "apNewsPolitics",
    apNewsBusiness: "apNewsBusiness",
    apNewsScience: "apNewsScience",
    apNewsTechnology: "apNewsTechnology",
    apNewsLifestyle: "apNewsLifestyle",
    apNewsEntertainment: "apNewsEntertainment",
    yahooUSNews: "yahooUSNews",
    yahooWorldNews: "yahooWorldNews",
    yahooPoliticsNews: "yahooPoliticsNews",
    yahooFinanceNews: "yahooFinanceNews",
    yahooEntertainmentNews: "yahooEntertainmentNews",
    yahooLifestyleNews: "yahooLifestyleNews",
    yahooScienceNews: "yahooScienceNews",
    cbsUS: "cbsUS",
    cbsWorld: "cbsWorld",
    cbsPolitics: "cbsPolitics",
    techCrunch: "techCrunch",
    abcNewsUS: "abcNewsUS",
    abcNewsInternational: "abcNewsInternational",
    abcNewsBusiness: "abcNewsBusiness",
    abcNewsTechnology: "abcNewsTechnology",
  };
  return nameMap[source] || source;
}

/**
 * Dispatches scraping requests to the appropriate scraper function
 * @param source - The source key from ScraperSwitches
 * @param count - Number of articles to scrape
 */
async function scrapeSource(source: SourceKey, count: number): Promise<void> {
  // Check if scraper is enabled
  if (!isScraperEnabled(source)) {
    return; // Silently skip disabled scrapers
  }

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

/**
 * Executes a scraping run based on the provided run configuration
 * @param run - The run configuration to execute
 */
export async function executeRun(run: RunConfig): Promise<void> {
  logger.info(
    `🚀 Executing run ${run.id} (${run.label})`
  );

  const startTime = Date.now();

  // Filter enabled sources and build summary
  const enabledSources: Array<{ source: SourceKey; count: number; name: string }> = [];
  
  for (const { source, count } of run.sources) {
    if (count <= 0) {
      continue; // Skip sources with 0 or negative count
    }
    
    if (isScraperEnabled(source)) {
      enabledSources.push({
        source,
        count,
        name: formatSourceName(source),
      });
    }
  }

  // Log summary of what will be scraped
  if (enabledSources.length > 0) {
    const plannedTotal = enabledSources.reduce((sum, { count }) => sum + count, 0);
    const summary = enabledSources
      .map(({ name, count }) => `${name} (${count} article${count !== 1 ? "s" : ""})`)
      .join(", ");
    logger.info(`Scraping ${summary} - Planned total: ${plannedTotal} articles`);
  } else {
    logger.info("No enabled sources to scrape");
  }

  // Execute scrapers silently (no per-source logging)
  for (const { source, count } of enabledSources) {
    await scrapeSource(source, count);
  }

  // Collect all articles from the run and save to collected folder
  const allArticles: any[] = [];
  for (const { source } of enabledSources) {
    const articles = getLatestArticlesFromSource(source);
    // Add origin field to each article
    const articlesWithOrigin = articles.map((article: any) => ({
      ...article,
      origin: source,
    }));
    allArticles.push(...articlesWithOrigin);
  }

  // Save collected articles to the collected folder
  const actualArticlesCount = allArticles.length;
  if (actualArticlesCount > 0) {
    const collectedPath = saveCollectedArticles(run.id, allArticles);
    logger.info(
      `📦 Collected ${actualArticlesCount} articles from ${run.id}`
    );

    // Process articles from the saved JSON file immediately after saving
    // Each article is processed individually through ChatGPT middleware
    try {
      await processCollectedArticlesFromRun(run.id, collectedPath);
      
      // Step 9: Send processed articles to Sanity CMS
      try {
        await sendProcessedArticlesToSanity(run.id);
      } catch (error) {
        logger.error(`Error sending articles to Sanity CMS for ${run.id}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } catch (error) {
      logger.error(`Error processing articles through ChatGPT middleware for ${run.id}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  } else {
    logger.warn(`⚠️  No articles collected from ${run.id}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(
    `✅ Successfully finished ${run.id} (${run.label}) - Total scraped articles: ${actualArticlesCount} (Duration: ${duration}s)`
  );
}

/**
 * Gets a run configuration by its ID
 * @param id - The run ID ("run1" | "run2" | "run3" | "run4")
 * @returns The run configuration
 * @throws Error if run ID is not found
 */
export function getRunById(id: RunConfig["id"]): RunConfig {
  const run = SCRAPING_RUNS.find((r) => r.id === id);
  if (!run) {
    throw new Error(`Run with id ${id} not found in SCRAPING_RUNS`);
  }
  return run;
}

/**
 * Executes a scraping run by its ID
 * @param id - The run ID ("run1" | "run2" | "run3" | "run4")
 */
export async function executeRunById(id: RunConfig["id"]): Promise<void> {
  if (!isRunEnabled(id)) {
    logger.warn(`⏸️  Run ${id} is disabled and will not be executed`);
    return;
  }
  const run = getRunById(id);
  await executeRun(run);
}

