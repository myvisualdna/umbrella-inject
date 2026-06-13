import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeYahooScienceNews,
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

interface YahooScienceScrapedArticle extends YahooArticleDetails {
  articleItem: YahooUSArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
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
  homepageItems: (YahooUSArticleItem & { category: string })[];
  articles: (YahooScienceScrapedArticle & { category: string })[];
}

export async function scrapeYahooNewsScience(limit: number = 5): Promise<void> {
  const items = await scrapeYahooScienceNews(limit);

  const articles: YahooScienceScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeYahooArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "yahooScienceNews", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("yahooScienceNews", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[science]yahooNews");
  const folderName = "[science]yahooNews";
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

  cleanupOldJsonFiles(outputDir, "yahoo-news-science-");
  saveScrapedData(scrapedData, outputDir, "yahoo-news-science");

  logger.info(`✅ Yahoo Science News finished with ${successCount} articles scraped correctly`);
}

