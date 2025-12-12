/**
 * Utility functions for ChatGPT Middleware
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { Article } from "./types";
import { CHATGPT_MIDDLEWARE_ENABLED } from "./config";
import { processArticleWithChatGPT } from "./processor";
import { processCollectedArticlesFromRun } from "./processor";
import { ProcessedArticle } from "../imageService/types";

/**
 * Processes multiple articles through ChatGPT middleware (batch processing)
 * 
 * @param articles - Array of articles to process
 * @param runId - The run ID (e.g., "run1", "run2")
 * @returns Map of article URLs to their ChatGPT responses
 */
export async function processArticlesWithChatGPT(
  articles: Article[],
  runId: string
): Promise<Map<string, ProcessedArticle | null>> {
  if (!CHATGPT_MIDDLEWARE_ENABLED) {
    logger.info(`ChatGPT middleware is disabled, skipping processing for ${runId}`);
    return new Map();
  }

  logger.info(`🤖 Processing ${articles.length} articles through ChatGPT middleware for ${runId}`);

  const results = new Map<string, ProcessedArticle | null>();

  // Console log batch information
  console.log("\n" + "=".repeat(80));
  console.log(`🚀 ChatGPT Middleware - Processing batch for ${runId}`);
  console.log(`Total articles: ${articles.length}`);
  console.log("=".repeat(80) + "\n");

  // Process articles sequentially to avoid rate limits
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    logger.info(`Processing article ${i + 1}/${articles.length}: ${article.title}`);

    const response = await processArticleWithChatGPT(article);
    results.set(article.url, response);

    // Add a small delay between requests to avoid rate limiting
    if (i < articles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  logger.info(`✅ Completed ChatGPT processing for ${runId}: ${results.size} articles processed`);

  return results;
}

/**
 * Processes all articles from collected JSON files (run1, run2, run3, run4)
 * 
 * This function finds all collected article files and processes them.
 * Each article is processed individually through the ChatGPT middleware.
 * 
 * @deprecated Use processCollectedArticlesFromRun for individual runs instead
 */
export async function processCollectedArticlesFromFiles(): Promise<void> {
  if (!CHATGPT_MIDDLEWARE_ENABLED) {
    logger.info("ChatGPT middleware is disabled, skipping processing of collected files");
    return;
  }

  const collectedDir = path.join(process.cwd(), "collected");
  
  if (!fs.existsSync(collectedDir)) {
    logger.warn(`Collected directory does not exist: ${collectedDir}`);
    return;
  }

  // Find all collected JSON files matching the pattern [runX]articles.json
  const files = fs.readdirSync(collectedDir);
  const collectedFiles = files
    .filter((file) => file.match(/^\[run\d+\]articles\.json$/))
    .map((file) => ({
      name: file,
      path: path.join(collectedDir, file),
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort by run number

  if (collectedFiles.length === 0) {
    logger.warn("No collected article files found in the collected folder");
    return;
  }

  logger.info(`📂 Found ${collectedFiles.length} collected article file(s) to process`);

  // Process each file
  for (const file of collectedFiles) {
    const runIdMatch = file.name.match(/\[(run\d+)\]/);
    if (runIdMatch) {
      await processCollectedArticlesFromRun(runIdMatch[1], file.path);
    }
  }

  logger.info(`\n🎉 Finished processing all collected article files`);
}
