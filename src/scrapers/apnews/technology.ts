import * as path from "path";
import { logger } from "../../config/logger";
import {
  scrapeAPNewsTechnologyHomepage,
  scrapeAPNewsArticleDetails,
  type APNewsArticleItem,
  type APNewsArticleDetails,
} from "../../sources/apNewsScraper";
import {
  extractCategoryFromFolder,
  cleanupOldJsonFiles,
  saveScrapedData,
} from "../../utils/scraperUtils";

interface APNewsTechnologyScrapedArticle extends APNewsArticleDetails {
  articleItem: APNewsArticleItem;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

interface APNewsTechnologyScrapedData {
  metadata: {
    savedAt: string;
    source: "apNewsTechnology";
    totalHomepageItems: number;
    totalArticlesScraped: number;
    totalArticlesFailed: number;
  };
  homepageItems: (APNewsArticleItem & { category: string })[];
  articles: (APNewsTechnologyScrapedArticle & { category: string })[];
}

export async function scrapeAPNewsTechnology(limit: number = 5): Promise<void> {
  const items = await scrapeAPNewsTechnologyHomepage(limit);

  const articles: APNewsTechnologyScrapedArticle[] = [];
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

  const outputDir = path.join(process.cwd(), "results", "[tech]apnews");
  const folderName = "[tech]apnews";
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
  const scrapedData: APNewsTechnologyScrapedData = {
    metadata: {
      savedAt: savedAt,
      source: "apNewsTechnology",
      totalHomepageItems: items.length,
      totalArticlesScraped: successCount,
      totalArticlesFailed: failureCount,
    },
    homepageItems: homepageItemsWithCategory,
    articles: articlesWithCategory,
  };

  cleanupOldJsonFiles(outputDir, "ap-news-technology-");
  saveScrapedData(scrapedData, outputDir, "ap-news-technology");

  logger.info(`✅ AP News Technology finished with ${successCount} articles scraped correctly`);
}

