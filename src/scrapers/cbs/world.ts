import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeCBSWorldNews,
  scrapeCBSWorldArticleDetails,
  type CBSWorldArticleItem,
  type CBSWorldArticleDetails,
} from "../../sources/cbsWorldScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

interface CBSWorldScrapedArticle extends CBSWorldArticleDetails {
  articleItem: CBSWorldArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSWorldScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsWorld";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (CBSWorldArticleItem & { category: string })[];
  articles: (CBSWorldScrapedArticle & { category: string })[];
}

export async function scrapeCBSWorld(limit: number = 5): Promise<void> {
  const items = await scrapeCBSWorldNews(limit);

  const articles: CBSWorldScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSWorldArticleDetails(item.url);

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
        `Failed to scrape CBS World article details for item #${index + 1}`,
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

  const outputDir = path.join(process.cwd(), "results", "[world]cbs");
  const folderName = "[world]cbs";
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
  const scrapedData: CBSWorldScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsWorld",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "cbs-world-");
  saveScrapedData(scrapedData, outputDir, "cbs-world");

  logger.info(`✅ CBS News World finished with ${successCount} articles scraped correctly`);
}

