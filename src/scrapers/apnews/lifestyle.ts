import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsLifestyleHomepage,
  scrapeAPNewsArticleDetails,
  type APNewsArticleItem,
  type APNewsArticleDetails,
} from "../../sources/apNewsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

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
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (APNewsLifestyleScrapedArticle & { category: string })[];
}

export async function scrapeAPNewsLifestyle(limit: number = 5): Promise<void> {
  const items = await scrapeAPNewsLifestyleHomepage(limit);

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

  const outputDir = path.join(process.cwd(), "results", "[lifestyle]apNews");
  const folderName = "[lifestyle]apNews";
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

  cleanupOldJsonFiles(outputDir, "ap-news-lifestyle-");
  saveScrapedData(scrapedData, outputDir, "ap-news-lifestyle");

  logger.info(`✅ AP News Lifestyle finished with ${successCount} articles scraped correctly`);
}

