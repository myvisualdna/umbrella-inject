import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeCBSUSNews,
  scrapeCBSUSArticleDetails,
  type CBSUSArticleItem,
  type CBSUSArticleDetails,
} from "../../sources/cbsUSScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

interface CBSScrapedArticle extends CBSUSArticleDetails {
  articleItem: CBSUSArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface CBSScrapedData {
  metadata: {
    savedAt: string;
    source: "cbsUS";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (CBSUSArticleItem & { category: string })[];
  articles: (CBSScrapedArticle & { category: string })[];
}

export async function scrapeCBSUS(limit: number = 5): Promise<void> {
  const items = await scrapeCBSUSNews(limit);

  const articles: CBSScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeCBSUSArticleDetails(item.url);

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
        `Failed to scrape CBS article details for item #${index + 1}`,
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

  const outputDir = path.join(process.cwd(), "results", "[us]cbs");
  const folderName = "[us]cbs";
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
  const scrapedData: CBSScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "cbsUS",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "cbs-us-");
  saveScrapedData(scrapedData, outputDir, "cbs-us");

  logger.info(`✅ CBS News US finished with ${successCount} articles scraped correctly`);
}

