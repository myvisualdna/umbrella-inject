import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeABCNewsInternationalHomepage,
  scrapeABCNewsInternationalArticleDetails,
  type ABCNewsInternationalArticleItem,
  type ABCNewsInternationalArticleDetails,
} from "../../sources/abcNewsInternationalScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

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
  homepageItems: (ABCNewsInternationalArticleItem & { category: string })[];
  articles: (ABCNewsInternationalScrapedArticle & { category: string })[];
}

export async function scrapeABCNewsInternational(limit: number = 5): Promise<void> {
  const items = await scrapeABCNewsInternationalHomepage(limit);

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

  const outputDir = path.join(process.cwd(), "results", "[world]abcnews");
  const folderName = "[world]abcnews";
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

  cleanupOldJsonFiles(outputDir, "abc-news-international-");
  saveScrapedData(scrapedData, outputDir, "abc-news-international");

  logger.info(`✅ ABC News International finished with ${successCount} articles scraped correctly`);
}

