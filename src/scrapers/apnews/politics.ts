import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsPoliticsHomepage,
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

interface APNewsPoliticsScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface APNewsPoliticsScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsPolitics";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (APNewsPoliticsScrapedArticle & { category: string })[];
}

export async function scrapeAPNewsPolitics(limit: number = 4): Promise<void> {
  const items = await scrapeAPNewsPoliticsHomepage(limit);

  const articles: APNewsPoliticsScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "apNewsPolitics", item) as typeof articles[number]
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
        buildScrapedArticleFailure("apNewsPolitics", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[politics]apNews");
  const folderName = "[politics]apNews";
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
  const scrapedData: APNewsPoliticsScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsPolitics",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "ap-news-politics-");
  saveScrapedData(scrapedData, outputDir, "ap-news-politics");

  logger.info(`✅ AP News Politics finished with ${successCount} articles scraped correctly`);
}

