import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeABCNewsBusinessHomepage,
  scrapeABCNewsBusinessArticleDetails,
  type ABCNewsBusinessArticleItem,
  type ABCNewsBusinessArticleDetails,
} from "../../sources/abcNewsBusinessScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";
import {
  buildScrapedArticleSuccess,
  buildScrapedArticleFailure,
} from "../../utils/buildScrapedArticle";

interface ABCNewsBusinessScrapedArticle extends ABCNewsBusinessArticleDetails {
  articleItem: ABCNewsBusinessArticleItem;
  scrapedAt: string;
  sourceKey: string;
  source: string;
  publishedAt: string | null;
  success: boolean;
  error?: string;
}

interface ABCNewsBusinessScrapedData {
  metadata: {
    savedAt: string;
    source: "abcNewsBusiness";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (ABCNewsBusinessArticleItem & { category: string })[];
  articles: (ABCNewsBusinessScrapedArticle & { category: string })[];
}

export async function scrapeABCNewsBusiness(limit: number = 5): Promise<void> {
  const items = await scrapeABCNewsBusinessHomepage(limit);

  const articles: ABCNewsBusinessScrapedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, item] of items.entries()) {
    try {
      const details = await scrapeABCNewsBusinessArticleDetails(item.url);

      articles.push(
        buildScrapedArticleSuccess(details, "abcNewsBusiness", item) as typeof articles[number]
      );

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to scrape ABC News Business article details for item #${index + 1}`,
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
      );

      articles.push(
        buildScrapedArticleFailure("abcNewsBusiness", item, item, errorMessage) as typeof articles[number]
      );

      failureCount++;
    }
  }

  const outputDir = path.join(process.cwd(), "results", "[business]abcnews");
  const folderName = "[business]abcnews";
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
  const scrapedData: ABCNewsBusinessScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "abcNewsBusiness",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "abc-news-business-");
  saveScrapedData(scrapedData, outputDir, "abc-news-business");

  logger.info(`✅ ABC News Business finished with ${successCount} articles scraped correctly`);
}

