import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeABCNewsTechnologyHomepage,
  scrapeABCNewsTechnologyArticleDetails,
  type ABCNewsTechnologyArticleItem,
  type ABCNewsTechnologyArticleDetails,
} from "../../sources/abcNewsTechnologyScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";
import {
  buildScrapedArticleSuccess,
  buildScrapedArticleFailure,
} from "../../utils/buildScrapedArticle";

interface ABCNewsTechnologyScrapedArticle extends ABCNewsTechnologyArticleDetails {
  articleItem: ABCNewsTechnologyArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
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
  homepageItems: (ABCNewsTechnologyArticleItem & { category: string })[];
  articles: (ABCNewsTechnologyScrapedArticle & { category: string })[];
}

export async function scrapeABCNewsTechnology(limit: number = 5): Promise<void> {
  const items = await scrapeABCNewsTechnologyHomepage(limit);

  const articles: ABCNewsTechnologyScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsTechnologyArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "abcNewsTechnology", item) as typeof articles[number]
      );

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

      articles.push(
        buildScrapedArticleFailure("abcNewsTechnology", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[tech]abcnews");
  const folderName = "[tech]abcnews";
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

  cleanupOldJsonFiles(outputDir, "abc-news-technology-");
  saveScrapedData(scrapedData, outputDir, "abc-news-technology");

  logger.info(`✅ ABC News Technology finished with ${successCount} articles scraped correctly`);
}

