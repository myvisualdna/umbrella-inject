import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeYahooUSNews,
  scrapeYahooArticleDetails,
  type YahooUSArticleItem,
  type YahooArticleDetails,
} from "../../sources/yahooNewsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";
import {
  buildScrapedArticleSuccess,
  buildScrapedArticleFailure,
} from "../../utils/buildScrapedArticle";

interface YahooScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface YahooScrapedData {
  metadata: {
    savedAt: string;
    source: "yahooUSNews";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (YahooUSArticleItem & { category: string })[];
  articles: (YahooScrapedArticle & { category: string })[];
}

export async function scrapeYahooNewsUS(limit: number = 4): Promise<void> {
  const items = await scrapeYahooUSNews(limit);

  const articles: YahooScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "yahooUSNews", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("yahooUSNews", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[us]yahooNews");
  const folderName = "[us]yahooNews";
  const category = extractCategoryFromFolder(folderName);

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
      source: "yahooUSNews",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "yahoo-news-us-");
  saveScrapedData(scrapedData, outputDir, "yahoo-news-us");

  logger.info(`✅ Yahoo News US finished with ${successCount} articles scraped correctly`);
}

