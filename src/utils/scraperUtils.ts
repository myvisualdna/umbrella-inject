import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";

/**
 * Extracts the category from a folder name like "[entertainment]apNews" -> "entertainment"
 * Normalizes categories: converts to lowercase and maps "technology" to "tech"
 */
export function extractCategoryFromFolder(folderName: string): string {
  const match = folderName.match(/\[([^\]]+)\]/);
  if (!match) return "";
  
  let category = match[1].toLowerCase();
  
  // Map "technology" to "tech"
  if (category === "technology") {
    category = "tech";
  }
  
  return category;
}

/**
 * Cleans up old JSON files, keeping only the most recent previous one
 */
export function cleanupOldJsonFiles(
  outputDir: string,
  filePrefix: string
): void {
  try {
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith(filePrefix) && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length > 1) {
      const filesToDelete = jsonFiles.slice(1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    logger.warn("Failed to clean up old JSON files", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Saves scraped data to a JSON file
 */
export function saveScrapedData<T>(
  data: T,
  outputDir: string,
  fileName: string
): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `${fileName}-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

  return outputPath;
}

/**
 * Maps source keys to their result folder names
 */
export function getResultFolderForSource(source: string): string {
  const folderMap: Record<string, string> = {
    apNewsUS: "[us]apNews",
    apNewsWorld: "[world]apNews",
    apNewsPolitics: "[politics]apNews",
    apNewsBusiness: "[business]apNews",
    apNewsScience: "[science]apNews",
    apNewsTechnology: "[tech]apnews",
    apNewsLifestyle: "[lifestyle]apNews",
    apNewsEntertainment: "[entertainment]apNews",
    yahooUSNews: "[us]yahooNews",
    yahooWorldNews: "[world]yahooNews",
    yahooPoliticsNews: "[politics]yahooNews",
    yahooFinanceNews: "[finance]yahooNews",
    yahooEntertainmentNews: "[entertainment]yahooNews",
    yahooLifestyleNews: "[lifestyle]yahooNews",
    yahooScienceNews: "[science]yahooNews",
    cbsUS: "[us]cbs",
    cbsWorld: "[world]cbs",
    cbsPolitics: "[politics]cbs",
    techCrunch: "[tech]techCrunch",
    abcNewsUS: "[us]abcnews",
    abcNewsInternational: "[world]abcnews",
    abcNewsBusiness: "[business]abcnews",
    abcNewsTechnology: "[tech]abcnews",
  };
  return folderMap[source] || "";
}

/**
 * Gets the file prefix for a source's result files
 */
export function getFilePrefixForSource(source: string): string {
  const prefixMap: Record<string, string> = {
    apNewsUS: "ap-news-",
    apNewsWorld: "ap-news-world-",
    apNewsPolitics: "ap-news-politics-",
    apNewsBusiness: "ap-news-business-",
    apNewsScience: "ap-news-science-",
    apNewsTechnology: "ap-news-technology-",
    apNewsLifestyle: "ap-news-lifestyle-",
    apNewsEntertainment: "ap-news-entertainment-",
    yahooUSNews: "yahoo-news-us-",
    yahooWorldNews: "yahoo-news-world-",
    yahooPoliticsNews: "yahoo-news-politics-",
    yahooFinanceNews: "yahoo-news-finance-",
    yahooEntertainmentNews: "yahoo-news-entertainment-",
    yahooLifestyleNews: "yahoo-news-lifestyle-",
    yahooScienceNews: "yahoo-news-science-",
    cbsUS: "cbs-us-",
    cbsWorld: "cbs-world-",
    cbsPolitics: "cbs-politics-",
    techCrunch: "techcrunch-",
    abcNewsUS: "abc-news-us-",
    abcNewsInternational: "abc-news-international-",
    abcNewsBusiness: "abc-news-business-",
    abcNewsTechnology: "abc-news-technology-",
  };
  return prefixMap[source] || "";
}

/**
 * Reads the latest result file for a source and extracts articles
 */
export function getLatestArticlesFromSource(source: string): any[] {
  try {
    const folderName = getResultFolderForSource(source);
    if (!folderName) {
      logger.warn(`No result folder mapping found for source: ${source}`);
      return [];
    }

    const outputDir = path.join(process.cwd(), "results", folderName);
    
    if (!fs.existsSync(outputDir)) {
      logger.warn(`Result directory does not exist: ${outputDir}`);
      return [];
    }

    const filePrefix = getFilePrefixForSource(source);
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files
      .filter((file) => file.startsWith(filePrefix) && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        stats: fs.statSync(path.join(outputDir, file)),
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (jsonFiles.length === 0) {
      logger.warn(`No result files found for source: ${source}`);
      return [];
    }

    // Read the most recent file
    const latestFile = jsonFiles[0];
    const fileContent = fs.readFileSync(latestFile.path, "utf-8");
    const data = JSON.parse(fileContent);

    // Extract articles from the data structure
    if (data.articles && Array.isArray(data.articles)) {
      return data.articles;
    }

    return [];
  } catch (error) {
    logger.error(`Failed to read articles for source ${source}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Saves collected articles to the collected folder
 * Removes the 'articleItem' field from each article before saving
 */
export function saveCollectedArticles(
  runId: string,
  articles: any[]
): string {
  const collectedDir = path.join(process.cwd(), "collected");
  
  if (!fs.existsSync(collectedDir)) {
    fs.mkdirSync(collectedDir, { recursive: true });
  }

  // Remove 'articleItem' field from each article
  const cleanedArticles = articles.map(({ articleItem, ...article }) => article);

  const outputPath = path.join(collectedDir, `[${runId}]articles.json`);
  const data = {
    runId,
    collectedAt: new Date().toISOString(),
    totalArticles: cleanedArticles.length,
    articles: cleanedArticles,
  };

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

  return outputPath;
}

