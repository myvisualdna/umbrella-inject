import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeYahooFinanceNews,
  scrapeYahooArticleDetails,
  type YahooUSArticleItem,
  type YahooArticleDetails,
} from "../../sources/yahooNewsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

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
  homepageItems: (YahooUSArticleItem & { category: string })[];
  articles: (YahooFinanceScrapedArticle & { category: string })[];
}

export async function scrapeYahooNewsFinance(limit: number = 4): Promise<void> {
  const items = await scrapeYahooFinanceNews(limit);

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

  const outputDir = path.join(process.cwd(), "results", "[finance]yahooNews");
  const folderName = "[finance]yahooNews";
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

  cleanupOldJsonFiles(outputDir, "yahoo-news-finance-");
  saveScrapedData(scrapedData, outputDir, "yahoo-news-finance");

  logger.info(`✅ Yahoo Finance News finished with ${successCount} articles scraped correctly`);
}

