import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeCBSPoliticsNews,
  scrapeCBSPoliticsArticleDetails,
  type CBSPoliticsArticleItem,
  type CBSPoliticsArticleDetails,
} from "../../sources/cbsPoliticsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

interface CBSPoliticsScrapedArticle extends CBSPoliticsArticleDetails {
  articleItem: CBSPoliticsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSPoliticsScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsPolitics";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (CBSPoliticsArticleItem & { category: string })[];
  articles: (CBSPoliticsScrapedArticle & { category: string })[];
}

export async function scrapeCBSPolitics(limit: number = 5): Promise<void> {
  const items = await scrapeCBSPoliticsNews(limit);

  const articles: CBSPoliticsScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSPoliticsArticleDetails(item.url);

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
        `Failed to scrape CBS Politics article details for item #${index + 1}`,
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

  const outputDir = path.join(process.cwd(), "results", "[politics]cbs");
  const folderName = "[politics]cbs";
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
  const scrapedData: CBSPoliticsScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsPolitics",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "cbs-politics-");
  saveScrapedData(scrapedData, outputDir, "cbs-politics");

  logger.info(`✅ CBS News Politics finished with ${successCount} articles scraped correctly`);
}

