import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeYahooLifestyleNews,
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

interface YahooLifestyleScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
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
  homepageItems: (YahooUSArticleItem & { category: string })[];
  articles: (YahooLifestyleScrapedArticle & { category: string })[];
}

export async function scrapeYahooNewsLifestyle(limit: number = 5): Promise<void> {
  const items = await scrapeYahooLifestyleNews(limit);

  const articles: YahooLifestyleScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "yahooLifestyleNews", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("yahooLifestyleNews", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[lifestyle]yahooNews");
  const folderName = "[lifestyle]yahooNews";
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

  cleanupOldJsonFiles(outputDir, "yahoo-news-lifestyle-");
  saveScrapedData(scrapedData, outputDir, "yahoo-news-lifestyle");

  logger.info(`✅ Yahoo Lifestyle News finished with ${successCount} articles scraped correctly`);
}

