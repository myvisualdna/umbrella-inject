import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsScienceHomepage,
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

interface APNewsScienceScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface APNewsScienceScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsScience";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (APNewsScienceScrapedArticle & { category: string })[];
}

export async function scrapeAPNewsScience(limit: number = 5): Promise<void> {
  const items = await scrapeAPNewsScienceHomepage(limit);

  const articles: APNewsScienceScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "apNewsScience", item) as typeof articles[number]
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
        buildScrapedArticleFailure("apNewsScience", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[science]apNews");
  const folderName = "[science]apNews";
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
  const scrapedData: APNewsScienceScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsScience",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "ap-news-science-");
  saveScrapedData(scrapedData, outputDir, "ap-news-science");

  logger.info(`✅ AP News Science finished with ${successCount} articles scraped correctly`);
}

