import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeABCNewsUSHomepage,
  scrapeABCNewsUSArticleDetails,
  type ABCNewsUSArticleItem,
  type ABCNewsUSArticleDetails,
} from "../../sources/abcNewsUSScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

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
  homepageItems: (ABCNewsUSArticleItem & { category: string })[];
  articles: (ABCNewsUSScrapedArticle & { category: string })[];
}

export async function scrapeABCNewsUS(limit: number = 5): Promise<void> {
  const items = await scrapeABCNewsUSHomepage(limit);

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

  const outputDir = path.join(process.cwd(), "results", "[us]abcnews");
  const folderName = "[us]abcnews";
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

  cleanupOldJsonFiles(outputDir, "abc-news-us-");
  saveScrapedData(scrapedData, outputDir, "abc-news-us");

  logger.info(`✅ ABC News US finished with ${successCount} articles scraped correctly`);
}

