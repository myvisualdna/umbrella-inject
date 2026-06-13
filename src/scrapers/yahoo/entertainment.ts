import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeYahooEntertainmentNews,
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

interface YahooEntertainmentScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
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
  homepageItems: (YahooUSArticleItem & { category: string })[];
  articles: (YahooEntertainmentScrapedArticle & { category: string })[];
}

export async function scrapeYahooNewsEntertainment(limit: number = 5): Promise<void> {
  const items = await scrapeYahooEntertainmentNews(limit);

  const articles: YahooEntertainmentScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "yahooEntertainmentNews", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("yahooEntertainmentNews", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[entertainment]yahooNews");
  const folderName = "[entertainment]yahooNews";
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

  cleanupOldJsonFiles(outputDir, "yahoo-news-entertainment-");
  saveScrapedData(scrapedData, outputDir, "yahoo-news-entertainment");

  logger.info(`✅ Yahoo Entertainment News finished with ${successCount} articles scraped correctly`);
}

