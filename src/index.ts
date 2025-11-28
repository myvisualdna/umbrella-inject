import * as fs from "fs";
import * as path from "path";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { scraperSwitches, isScraperEnabled } from "./config/scraperSwitches";
import {
  scrapeAPNewsHomepage,
  scrapeAPNewsWorldHomepage,
  scrapeAPNewsPoliticsHomepage,
  scrapeAPNewsBusinessHomepage,
  scrapeAPNewsScienceHomepage,
  scrapeAPNewsTechnologyHomepage,
  scrapeAPNewsLifestyleHomepage,
  scrapeAPNewsEntertainmentHomepage,
  scrapeAPNewsArticleDetails,
  type APNewsArticleItem,
  type APNewsArticleDetails,
} from "./sources/apNewsScraper";
import {
  scrapeYahooUSNews,
  scrapeYahooWorldNews,
  scrapeYahooPoliticsNews,
  scrapeYahooFinanceNews,
  scrapeYahooEntertainmentNews,
  scrapeYahooLifestyleNews,
  scrapeYahooScienceNews,
  scrapeYahooArticleDetails,
  type YahooUSArticleItem,
  type YahooArticleDetails,
} from "./sources/yahooNewsScraper";
import {
  scrapeCBSUSNews,
  scrapeCBSUSArticleDetails,
  type CBSUSArticleItem,
  type CBSUSArticleDetails,
} from "./sources/cbsUSScraper";
import {
  scrapeCBSWorldNews,
  scrapeCBSWorldArticleDetails,
  type CBSWorldArticleItem,
  type CBSWorldArticleDetails,
} from "./sources/cbsWorldScraper";
import {
  scrapeCBSPoliticsNews,
  scrapeCBSPoliticsArticleDetails,
  type CBSPoliticsArticleItem,
  type CBSPoliticsArticleDetails,
} from "./sources/cbsPoliticsScraper";
import {
  scrapeTechCrunchNews,
  scrapeTechCrunchArticleDetails,
  type TechCrunchArticleItem,
  type TechCrunchArticleDetails,
} from "./sources/techCrunchScraper";
import {
  scrapeABCNewsUSHomepage,
  scrapeABCNewsUSArticleDetails,
  type ABCNewsUSArticleItem,
  type ABCNewsUSArticleDetails,
} from "./sources/abcNewsUSScraper";
import {
  scrapeABCNewsInternationalHomepage,
  scrapeABCNewsInternationalArticleDetails,
  type ABCNewsInternationalArticleItem,
  type ABCNewsInternationalArticleDetails,
} from "./sources/abcNewsInternationalScraper";
import {
  scrapeABCNewsBusinessHomepage,
  scrapeABCNewsBusinessArticleDetails,
  type ABCNewsBusinessArticleItem,
  type ABCNewsBusinessArticleDetails,
} from "./sources/abcNewsBusinessScraper";
import {
  scrapeABCNewsTechnologyHomepage,
  scrapeABCNewsTechnologyArticleDetails,
  type ABCNewsTechnologyArticleItem,
  type ABCNewsTechnologyArticleDetails,
} from "./sources/abcNewsTechnologyScraper";

/**
 * Extracts the category from a folder name like "[entertainment]apNews" -> "entertainment"
 */
function extractCategoryFromFolder(folderName: string): string {
  const match = folderName.match(/\[([^\]]+)\]/);
  return match ? match[1] : "";
}

interface ScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface ScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsUS";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: ScrapedArticle[];
}

interface APNewsWorldScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsWorldScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsWorld";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsWorldScrapedArticle[];
}

interface APNewsPoliticsScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsPoliticsScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsPolitics";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsPoliticsScrapedArticle[];
}

interface APNewsBusinessScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsBusinessScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsBusiness";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsBusinessScrapedArticle[];
}

interface APNewsScienceScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsScienceScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsScience";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsScienceScrapedArticle[];
}

interface APNewsTechnologyScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsTechnologyScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsTechnology";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsTechnologyScrapedArticle[];
}

interface APNewsLifestyleScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsLifestyleScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsLifestyle";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsLifestyleScrapedArticle[];
}

interface APNewsEntertainmentScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsEntertainmentScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsEntertainment";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: APNewsArticleItem[];
  articles: APNewsEntertainmentScrapedArticle[];
}

async function bootstrap() {
  logger.info("🚀 App started");

  // Log active scrapers
  logger.info("Scraper switches:", scraperSwitches);

  // 1) Scrape AP News homepage for article items (if enabled)
  if (isScraperEnabled("apNewsUS")) {
    await scrapeAPNews();
  } else {
    logger.info("⏸️  AP News US scraping is disabled");
  }

  // 1.5) Scrape AP News World section (if enabled)
  if (isScraperEnabled("apNewsWorld")) {
    await scrapeAPNewsWorld();
  } else {
    logger.info("⏸️  AP News World scraping is disabled");
  }

  // 1.6) Scrape AP News Politics section (if enabled)
  if (isScraperEnabled("apNewsPolitics")) {
    await scrapeAPNewsPolitics();
  } else {
    logger.info("⏸️  AP News Politics scraping is disabled");
  }

  // 1.7) Scrape AP News Business section (if enabled)
  if (isScraperEnabled("apNewsBusiness")) {
    await scrapeAPNewsBusiness();
  } else {
    logger.info("⏸️  AP News Business scraping is disabled");
  }

  // 1.8) Scrape AP News Science section (if enabled)
  if (isScraperEnabled("apNewsScience")) {
    await scrapeAPNewsScience();
  } else {
    logger.info("⏸️  AP News Science scraping is disabled");
  }

  // 1.9) Scrape AP News Technology section (if enabled)
  if (isScraperEnabled("apNewsTechnology")) {
    await scrapeAPNewsTechnology();
  } else {
    logger.info("⏸️  AP News Technology scraping is disabled");
  }

  // 1.10) Scrape AP News Lifestyle section (if enabled)
  if (isScraperEnabled("apNewsLifestyle")) {
    await scrapeAPNewsLifestyle();
  } else {
    logger.info("⏸️  AP News Lifestyle scraping is disabled");
  }

  // 1.11) Scrape AP News Entertainment section (if enabled)
  if (isScraperEnabled("apNewsEntertainment")) {
    await scrapeAPNewsEntertainment();
  } else {
    logger.info("⏸️  AP News Entertainment scraping is disabled");
  }

  // 2) Scrape Yahoo News US section (if enabled)
  if (isScraperEnabled("yahooUSNews")) {
    await scrapeYahooNewsUS();
  } else {
    logger.info("⏸️  Yahoo US News scraping is disabled");
  }

  // 2.5) Scrape Yahoo News World section (if enabled)
  if (isScraperEnabled("yahooWorldNews")) {
    await scrapeYahooNewsWorld();
  } else {
    logger.info("⏸️  Yahoo World News scraping is disabled");
  }

  // 2.6) Scrape Yahoo News Politics section (if enabled)
  if (isScraperEnabled("yahooPoliticsNews")) {
    await scrapeYahooNewsPolitics();
  } else {
    logger.info("⏸️  Yahoo Politics News scraping is disabled");
  }

  // 2.7) Scrape Yahoo Finance News section (if enabled)
  if (isScraperEnabled("yahooFinanceNews")) {
    await scrapeYahooNewsFinance();
  } else {
    logger.info("⏸️  Yahoo Finance News scraping is disabled");
  }

  // 2.8) Scrape Yahoo Entertainment News section (if enabled)
  if (isScraperEnabled("yahooEntertainmentNews")) {
    await scrapeYahooNewsEntertainment();
  } else {
    logger.info("⏸️  Yahoo Entertainment News scraping is disabled");
  }

  // 2.9) Scrape Yahoo Lifestyle News section (if enabled)
  if (isScraperEnabled("yahooLifestyleNews")) {
    await scrapeYahooNewsLifestyle();
  } else {
    logger.info("⏸️  Yahoo Lifestyle News scraping is disabled");
  }

  // 2.10) Scrape Yahoo Science News section (if enabled)
  if (isScraperEnabled("yahooScienceNews")) {
    await scrapeYahooNewsScience();
  } else {
    logger.info("⏸️  Yahoo Science News scraping is disabled");
  }

  // 3) Scrape CBS News US section (if enabled)
  if (isScraperEnabled("cbsUS")) {
    await scrapeCBSUS();
  } else {
    logger.info("⏸️  CBS US scraping is disabled");
  }

  // 4) Scrape CBS News World section (if enabled)
  if (isScraperEnabled("cbsWorld")) {
    await scrapeCBSWorld();
  } else {
    logger.info("⏸️  CBS World scraping is disabled");
  }

  // 5) Scrape CBS News Politics section (if enabled)
  if (isScraperEnabled("cbsPolitics")) {
    await scrapeCBSPolitics();
  } else {
    logger.info("⏸️  CBS Politics scraping is disabled");
  }

  // 6) Scrape TechCrunch homepage (if enabled)
  if (isScraperEnabled("techCrunch")) {
    await scrapeTechCrunch();
  } else {
    logger.info("⏸️  TechCrunch scraping is disabled");
  }

  // 7) Scrape ABC News US section (if enabled)
  if (isScraperEnabled("abcNewsUS")) {
    await scrapeABCNewsUS();
  } else {
    logger.info("⏸️  ABC News US scraping is disabled");
  }

  // 8) Scrape ABC News International section (if enabled)
  if (isScraperEnabled("abcNewsInternational")) {
    await scrapeABCNewsInternational();
  } else {
    logger.info("⏸️  ABC News International scraping is disabled");
  }

  // 9) Scrape ABC News Business section (if enabled)
  if (isScraperEnabled("abcNewsBusiness")) {
    await scrapeABCNewsBusiness();
  } else {
    logger.info("⏸️  ABC News Business scraping is disabled");
  }

  // 10) Scrape ABC News Technology section (if enabled)
  if (isScraperEnabled("abcNewsTechnology")) {
    await scrapeABCNewsTechnology();
  } else {
    logger.info("⏸️  ABC News Technology scraping is disabled");
  }
}

async function scrapeAPNews() {
  logger.info("Scraping AP News...");
  const items = await scrapeAPNewsHomepage(5);

  // 2) For each item, scrape the article details and collect results
  const articles: ScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[us]apNews");
  const folderName = "[us]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: ScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsUS",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsWorld() {
  logger.info("Scraping AP News World...");
  const items = await scrapeAPNewsWorldHomepage(5);

  // 2) For each item, scrape the article details and collect results
  const articles: APNewsWorldScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[world]apNews");
  const folderName = "[world]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsWorldScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsWorld",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-world-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-world-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News World finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsPolitics() {
  logger.info("Scraping AP News Politics...");
  const items = await scrapeAPNewsPoliticsHomepage(4);

  // 2) For each item, scrape the article details and collect results
  const articles: APNewsPoliticsScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[politics]apNews");
  const folderName = "[politics]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsPoliticsScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsPolitics",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-politics-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-politics-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Politics finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsBusiness() {
  logger.info("Scraping AP News Business...");
  const items = await scrapeAPNewsBusinessHomepage(5);

  // 2) For each item, scrape the article details and collect results
  const articles: APNewsBusinessScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
      try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[business]apNews");
  const folderName = "[business]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsBusinessScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsBusiness",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-business-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-business-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Business finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsScience() {
  logger.info("Scraping AP News Science...");
  const items = await scrapeAPNewsScienceHomepage(5);


  // 2) For each item, scrape the article details and collect results
  const articles: APNewsScienceScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
      try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[science]apNews");
  const folderName = "[science]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsScienceScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsScience",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-science-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-science-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Science finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsTechnology() {
  logger.info("Scraping AP News Technology...");
  const items = await scrapeAPNewsTechnologyHomepage(5);


  // 2) For each item, scrape the article details and collect results
  const articles: APNewsTechnologyScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
      try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[tech]apnews");
  const folderName = "[tech]apnews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsTechnologyScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsTechnology",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-technology-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-technology-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Technology finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsLifestyle() {
  logger.info("Scraping AP News Lifestyle...");
  const items = await scrapeAPNewsLifestyleHomepage(5);


  // 2) For each item, scrape the article details and collect results
  const articles: APNewsLifestyleScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
      try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[lifestyle]apNews");
  const folderName = "[lifestyle]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsLifestyleScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsLifestyle",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-lifestyle-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-lifestyle-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Lifestyle finished with ${successCount} articles scraped correctly`);
}

async function scrapeAPNewsEntertainment() {
  logger.info("Scraping AP News Entertainment...");
  const items = await scrapeAPNewsEntertainmentHomepage(5);


  // 2) For each item, scrape the article details and collect results
  const articles: APNewsEntertainmentScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
      try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // 3) Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[entertainment]apNews");
  const folderName = "[entertainment]apNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: APNewsEntertainmentScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsEntertainment",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  // This allows comparison between current and previous scrape for duplicate detection
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("ap-news-entertainment-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Sort by modification time, newest first
    
    // Keep only the most recent file (if any), delete all older ones
    // After we save the new file, we'll have: previous (most recent old) + current (new)
    if (jsonFiles.length > 1) {
      // Delete all except the most recent one
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ap-news-entertainment-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ AP News Entertainment finished with ${successCount} articles scraped correctly`);
}

interface YahooScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooNewsUS";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooScrapedArticle[];
}

async function scrapeYahooNewsUS() {
  logger.info("Scraping Yahoo News US...");

  // Target articles to find
  const targetTitles = [
    "Judge dismisses James Comey, Letitia James cases over prosecutor's appointment",
    "US DOJ's misconduct complaint against judge in transgender military ban case gets tossed",
    "She lost her son to gun violence. Now she's part of a movement credited with Baltimore's crime drop",
    "Tornado leaves behind 'significant' path of destruction in Houston area",
  ];

  const items = await scrapeYahooUSNews(targetTitles);


  // For each item, scrape the article details
  const articles: YahooScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[us]yahooNews");
  const folderName = "[us]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooNewsUS",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => (file.startsWith("yahoo-news-") || file.startsWith("yahoo-news-us-")) && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo News US JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-us-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo News US finished with ${successCount} articles scraped correctly`);
}

interface YahooWorldScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooWorldScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooNewsWorld";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooWorldScrapedArticle[];
}

async function scrapeYahooNewsWorld() {
  logger.info("Scraping Yahoo News World...");

  // Scrape the latest articles from Yahoo News World section
  const items = await scrapeYahooWorldNews(4);


  // For each item, scrape the article details
  const articles: YahooWorldScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo World article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[world]yahooNews");
  const folderName = "[world]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooWorldScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooNewsWorld",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-world-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo World JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-world-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo News World finished with ${successCount} articles scraped correctly`);
}

interface YahooPoliticsScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooPoliticsScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooNewsPolitics";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooPoliticsScrapedArticle[];
}

async function scrapeYahooNewsPolitics() {
  logger.info("Scraping Yahoo News Politics...");

  // Scrape the latest articles from Yahoo News Politics section
  const items = await scrapeYahooPoliticsNews(7);


  // For each item, scrape the article details
  const articles: YahooPoliticsScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo Politics article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[politics]yahooNews");
  const folderName = "[politics]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooPoliticsScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooNewsPolitics",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-politics-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo Politics JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-politics-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo News Politics finished with ${successCount} articles scraped correctly`);
}

interface YahooFinanceScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooFinanceScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooFinanceNews";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooFinanceScrapedArticle[];
}

async function scrapeYahooNewsFinance() {
  logger.info("Scraping Yahoo Finance News...");

  // Scrape the latest articles from Yahoo Finance section
  const items = await scrapeYahooFinanceNews(4);


  // For each item, scrape the article details
  const articles: YahooFinanceScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo Finance article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[finance]yahooNews");
  const folderName = "[finance]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooFinanceScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooFinanceNews",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-finance-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo Finance JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-finance-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo Finance News finished with ${successCount} articles scraped correctly`);
}

interface YahooEntertainmentScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooEntertainmentScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooEntertainmentNews";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooEntertainmentScrapedArticle[];
}

async function scrapeYahooNewsEntertainment() {
  logger.info("Scraping Yahoo Entertainment News...");

  // Scrape the latest articles from Yahoo Entertainment section
  const items = await scrapeYahooEntertainmentNews(5);


  // For each item, scrape the article details
  const articles: YahooEntertainmentScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo Entertainment article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[entertainment]yahooNews");
  const folderName = "[entertainment]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooEntertainmentScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooEntertainmentNews",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-entertainment-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo Entertainment JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-entertainment-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo Entertainment News finished with ${successCount} articles scraped correctly`);
}

interface YahooLifestyleScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooLifestyleScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooLifestyleNews";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooLifestyleScrapedArticle[];
}

async function scrapeYahooNewsLifestyle() {
  logger.info("Scraping Yahoo Lifestyle News...");

  // Scrape the latest articles from Yahoo Lifestyle section
  const items = await scrapeYahooLifestyleNews(5);


  // For each item, scrape the article details
  const articles: YahooLifestyleScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo Lifestyle article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[lifestyle]yahooNews");
  const folderName = "[lifestyle]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooLifestyleScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooLifestyleNews",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-lifestyle-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo Lifestyle JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-lifestyle-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo Lifestyle News finished with ${successCount} articles scraped correctly`);
}

interface YahooScienceScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface YahooScienceScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooScienceNews";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: YahooUSArticleItem[];
  articles: YahooScienceScrapedArticle[];
}

async function scrapeYahooNewsScience() {
  logger.info("Scraping Yahoo Science News...");

  // Scrape the latest articles from Yahoo Science News section
  const items = await scrapeYahooScienceNews(5);


  // For each item, scrape the article details
  const articles: YahooScienceScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape Yahoo Science article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[science]yahooNews");
  const folderName = "[science]yahooNews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: YahooScienceScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "yahooScienceNews",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("yahoo-news-science-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old Yahoo Science JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `yahoo-news-science-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ Yahoo Science News finished with ${successCount} articles scraped correctly`);
}

interface CBSScrapedArticle extends CBSUSArticleDetails {
  articleItem: CBSUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsUS";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: CBSUSArticleItem[];
  articles: CBSScrapedArticle[];
}

async function scrapeCBSUS() {
  logger.info("Scraping CBS News US...");

  // Scrape the latest articles from CBS News US section
  const items = await scrapeCBSUSNews(5);


  // For each item, scrape the article details
  const articles: CBSScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSUSArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape CBS article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[us]cbs");
  const folderName = "[us]cbs";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: CBSScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsUS",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("cbs-us-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old CBS JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `cbs-us-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ CBS News US finished with ${successCount} articles scraped correctly`);
}

interface CBSWorldScrapedArticle extends CBSWorldArticleDetails {
  articleItem: CBSWorldArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSWorldScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsWorld";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: CBSWorldArticleItem[];
  articles: CBSWorldScrapedArticle[];
}

async function scrapeCBSWorld() {
  logger.info("Scraping CBS News World...");

  // Scrape the latest articles from CBS News World section
  const items = await scrapeCBSWorldNews(5);


  // For each item, scrape the article details
  const articles: CBSWorldScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSWorldArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape CBS World article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[world]cbs");
  const folderName = "[world]cbs";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: CBSWorldScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsWorld",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("cbs-world-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old CBS World JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `cbs-world-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ CBS News World finished with ${successCount} articles scraped correctly`);
}

interface CBSPoliticsScrapedArticle extends CBSPoliticsArticleDetails {
  articleItem: CBSPoliticsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSPoliticsScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsPolitics";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: CBSPoliticsArticleItem[];
  articles: CBSPoliticsScrapedArticle[];
}

async function scrapeCBSPolitics() {
  logger.info("Scraping CBS News Politics...");

  // Scrape the latest articles from CBS News Politics section
  const items = await scrapeCBSPoliticsNews(5);


  // For each item, scrape the article details
  const articles: CBSPoliticsScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSPoliticsArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape CBS Politics article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[politics]cbs");
  const folderName = "[politics]cbs";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: CBSPoliticsScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsPolitics",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("cbs-politics-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old CBS Politics JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `cbs-politics-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ CBS News Politics finished with ${successCount} articles scraped correctly`);
}

interface TechCrunchScrapedArticle extends TechCrunchArticleDetails {
  articleItem: TechCrunchArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface TechCrunchScrapedData {
  metadata: {
    savedAt: string;
    source: "techCrunch";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: TechCrunchArticleItem[];
  articles: TechCrunchScrapedArticle[];
}

async function scrapeTechCrunch() {
  logger.info("Scraping TechCrunch...");

  // Scrape the latest articles from TechCrunch homepage
  const items = await scrapeTechCrunchNews(5);


  // For each item, scrape the article details
  const articles: TechCrunchScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeTechCrunchArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape TechCrunch article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[tech]techCrunch");
  const folderName = "[tech]techCrunch";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: TechCrunchScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "techCrunch",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("techcrunch-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old TechCrunch JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `techcrunch-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ TechCrunch finished with ${successCount} articles scraped correctly`);
}

interface ABCNewsUSScrapedArticle extends ABCNewsUSArticleDetails {
  articleItem: ABCNewsUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface ABCNewsUSScrapedData {
  metadata: {
    savedAt: string;
    source: "abcNewsUS";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: ABCNewsUSArticleItem[];
  articles: ABCNewsUSScrapedArticle[];
}

async function scrapeABCNewsUS() {
  logger.info("Scraping ABC News US...");

  const items = await scrapeABCNewsUSHomepage(5);


  // For each item, scrape the article details
  const articles: ABCNewsUSScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsUSArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape ABC News US article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[us]abcnews");
  const folderName = "[us]abcnews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: ABCNewsUSScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "abcNewsUS",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("abc-news-us-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old ABC News US JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `abc-news-us-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ ABC News US finished with ${successCount} articles scraped correctly`);
}

interface ABCNewsInternationalScrapedArticle extends ABCNewsInternationalArticleDetails {
  articleItem: ABCNewsInternationalArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface ABCNewsInternationalScrapedData {
  metadata: {
    savedAt: string;
    source: "abcNewsInternational";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: ABCNewsInternationalArticleItem[];
  articles: ABCNewsInternationalScrapedArticle[];
}

async function scrapeABCNewsInternational() {
  logger.info("Scraping ABC News International...");

  const items = await scrapeABCNewsInternationalHomepage(5);


  // For each item, scrape the article details
  const articles: ABCNewsInternationalScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsInternationalArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape ABC News International article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[world]abcnews");
  const folderName = "[world]abcnews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: ABCNewsInternationalScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "abcNewsInternational",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("abc-news-international-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old ABC News International JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `abc-news-international-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ ABC News International finished with ${successCount} articles scraped correctly`);
}

interface ABCNewsBusinessScrapedArticle extends ABCNewsBusinessArticleDetails {
  articleItem: ABCNewsBusinessArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface ABCNewsBusinessScrapedData {
  metadata: {
    savedAt: string;
    source: "abcNewsBusiness";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: ABCNewsBusinessArticleItem[];
  articles: ABCNewsBusinessScrapedArticle[];
}

async function scrapeABCNewsBusiness() {
  logger.info("Scraping ABC News Business...");

  const items = await scrapeABCNewsBusinessHomepage(5);


  // For each item, scrape the article details
  const articles: ABCNewsBusinessScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsBusinessArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape ABC News Business article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[business]abcnews");
  const folderName = "[business]abcnews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: ABCNewsBusinessScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "abcNewsBusiness",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("abc-news-business-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old ABC News Business JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `abc-news-business-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ ABC News Business finished with ${successCount} articles scraped correctly`);
}

interface ABCNewsTechnologyScrapedArticle extends ABCNewsTechnologyArticleDetails {
  articleItem: ABCNewsTechnologyArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface ABCNewsTechnologyScrapedData {
  metadata: {
    savedAt: string;
    source: "abcNewsTechnology";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: ABCNewsTechnologyArticleItem[];
  articles: ABCNewsTechnologyScrapedArticle[];
}

async function scrapeABCNewsTechnology() {
  logger.info("Scraping ABC News Technology...");

  const items = await scrapeABCNewsTechnologyHomepage(5);


  // For each item, scrape the article details
  const articles: ABCNewsTechnologyScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsTechnologyArticleDetails(item.url);

      articles.push({
        ...details,
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: true,
      });

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape ABC News Technology article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push({
        url: item.url,
        title: item.title || "Unknown",
        excerpt: "",
        category: null,
        body: "",
        articleItem: item,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      });

      failureCount++;
    }
  }

  // Save all scraped data to JSON file
  const outputDir = path.join(process.cwd(), "results", "[tech]abcnews");
  const folderName = "[tech]abcnews";
  const category = extractCategoryFromFolder(folderName);

  // Add category field to homepageItems and articles
  const homepageItemsWithCategory = items.map((item) => ({
    ...item,
    category,
  }));

  const articlesWithCategory = articles.map((article) => ({
    ...article,
    category,
  }));

  const savedAt = new Date().toISOString();
  const scrapedData: ABCNewsTechnologyScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "abcNewsTechnology",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean up old JSON files, keeping only the most recent previous one
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith("abc-news-technology-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    }
  } catch (error) {
    logger.warn("Failed to clean up old ABC News Technology JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `abc-news-technology-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2), "utf-8");

  logger.info(`✅ ABC News Technology finished with ${successCount} articles scraped correctly`);
}

void bootstrap();

