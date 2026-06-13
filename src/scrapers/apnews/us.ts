import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsHomepage,
  scrapeAPNewsArticleDetails,
  type APNewsArticleItem,
  type APNewsArticleDetails,
} from "../../sources/apNewsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";
import {
  buildScrapedArticleSuccess,
  buildScrapedArticleFailure,
} from "../../utils/buildScrapedArticle";

interface ScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
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
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (ScrapedArticle & { category: string })[];
}

export async function scrapeAPNews(limit: number = 5): Promise<void> {
  const items = await scrapeAPNewsHomepage(limit);

  const articles: ScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "apNewsUS", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("apNewsUS", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[us]apNews");
  const folderName = "[us]apNews";
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

  cleanupOldJsonFiles(outputDir, "ap-news-");
  saveScrapedData(scrapedData, outputDir, "ap-news");

  logger.info(`✅ AP News finished with ${successCount} articles scraped correctly`);
}

