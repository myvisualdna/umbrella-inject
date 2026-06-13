import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsEntertainmentHomepage,
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

interface APNewsEntertainmentScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface APNewsEntertainmentScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsEntertainment";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (APNewsEntertainmentScrapedArticle & { category: string })[];
}

export async function scrapeAPNewsEntertainment(limit: number = 5): Promise<void> {
  const items = await scrapeAPNewsEntertainmentHomepage(limit);

  const articles: APNewsEntertainmentScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeAPNewsArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "apNewsEntertainment", item) as typeof articles[number]
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
        buildScrapedArticleFailure("apNewsEntertainment", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[entertainment]apNews");
  const folderName = "[entertainment]apNews";
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
  const scrapedData: APNewsEntertainmentScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsEntertainment",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "ap-news-entertainment-");
  saveScrapedData(scrapedData, outputDir, "ap-news-entertainment");

  logger.info(`✅ AP News Entertainment finished with ${successCount} articles scraped correctly`);
}

