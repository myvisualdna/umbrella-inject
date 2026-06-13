import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeTechCrunchNews,
  scrapeTechCrunchArticleDetails,
  type TechCrunchArticleItem,
  type TechCrunchArticleDetails,
} from "../../sources/techCrunchScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";
import {
  buildScrapedArticleSuccess,
  buildScrapedArticleFailure,
} from "../../utils/buildScrapedArticle";

interface TechCrunchScrapedArticle extends TechCrunchArticleDetails {
  articleItem: TechCrunchArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface TechCrunchScrapedData {
  metadata: {
    savedAt: string;
    source: "techCrunch";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (TechCrunchArticleItem & { category: string })[];
  articles: (TechCrunchScrapedArticle & { category: string })[];
}

export async function scrapeTechCrunch(limit: number = 5): Promise<void> {
  const items = await scrapeTechCrunchNews(limit);

  const articles: TechCrunchScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeTechCrunchArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "techCrunch", item) as typeof articles[number]
      );

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape TechCrunch article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push(
        buildScrapedArticleFailure("techCrunch", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[tech]techCrunch");
  const folderName = "[tech]techCrunch";
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
  const scrapedData: TechCrunchScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "techCrunch",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "techcrunch-");
  saveScrapedData(scrapedData, outputDir, "techcrunch");

  logger.info(`✅ TechCrunch finished with ${successCount} articles scraped correctly`);
}

