/**
 * Main processing functions for ChatGPT Middleware
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { Article, CollectedArticlesFile } from "./types";
import { CHATGPT_MIDDLEWARE_ENABLED, CHATGPT_REQUEST_DELAY_MS } from "./config";
import { sendToChatGPT, createRequestPayload } from "./api";
import { processArticleWithImage } from "../imageService/orchestrator";
import { ProcessedArticle } from "../imageService/types";

/**
 * Processes a single article through ChatGPT middleware
 * 
 * This is the main entry point for processing individual articles.
 * It filters the article, creates a prompt, sends it to ChatGPT,
 * and returns the processed article with image data.
 * 
 * @param article - The article object to process
 * @returns The processed article with image data, or null if processing fails
 */
export async function processArticleWithChatGPT(article: Article): Promise<ProcessedArticle | null> {
  if (!CHATGPT_MIDDLEWARE_ENABLED) {
    logger.debug("ChatGPT middleware is disabled, skipping article processing");
    console.log("\n" + "=".repeat(80));
    console.log("⚠️  ChatGPT middleware is disabled - cannot process article");
    console.log("=".repeat(80) + "\n");
    return null;
  }

  // Step 1: Send to ChatGPT
  logger.debug(`Sending article to ChatGPT: ${article.title}`);
  const response = await sendToChatGPT(article);

  if (!response) {
    logger.error("❌ ChatGPT API returned no response");
    console.log("❌ Step 1 failed: ChatGPT API returned no response\n");
    return null;
  }

  logger.debug("ChatGPT response received, processing with image service");

  // Step 2: Process with image service
  try {
    const processedArticle = await processArticleWithImage(
      response,
      article.category
    );

    if (!processedArticle) {
      logger.error("❌ Failed to process article with image service");
      console.log("❌ Step 2 failed: Image service processing returned null\n");
      return null;
    }

    logger.debug("Article successfully processed");
    return processedArticle;
  } catch (error) {
    logger.error("❌ Error in processArticleWithImage:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.log(`❌ Step 2 failed: Error in image service - ${error instanceof Error ? error.message : String(error)}\n`);
    return null;
  }
}

/**
 * Processes articles from a specific run's collected JSON file
 * 
 * This function reads a saved JSON file (e.g., [run1]articles.json),
 * extracts all articles, and processes each one individually through
 * the ChatGPT middleware.
 * 
 * @param runId - The run ID (e.g., "run1", "run2", "run3", "run4")
 * @param filePath - Optional path to the JSON file. If not provided, will construct from runId
 */
export async function processCollectedArticlesFromRun(
  runId: string,
  filePath?: string
): Promise<void> {
  const collectedDir = path.join(process.cwd(), "collected");
  
  if (!fs.existsSync(collectedDir)) {
    logger.warn(`Collected directory does not exist: ${collectedDir}`);
    return;
  }

  // Construct file path if not provided
  const targetPath = filePath || path.join(collectedDir, `[${runId}]articles.json`);

  if (!fs.existsSync(targetPath)) {
    logger.warn(`⚠️  Collected articles file not found: ${targetPath}`);
    return;
  }

  try {
    console.log("\n" + "=".repeat(80));
    console.log(`🤖 ChatGPT Middleware - Processing articles from ${runId}`);
    console.log(`📄 File: ${path.basename(targetPath)}`);
    console.log("=".repeat(80) + "\n");
    
    // Read the JSON file
    const fileContent = fs.readFileSync(targetPath, "utf-8");
    const data: CollectedArticlesFile = JSON.parse(fileContent);

    if (!data.articles || !Array.isArray(data.articles)) {
      logger.warn(`⚠️  File ${path.basename(targetPath)} does not contain a valid articles array`);
      return;
    }

    if (data.articles.length === 0) {
      console.log(`ℹ️  No articles to process in ${runId}\n`);
      return;
    }

    console.log(`📊 Found ${data.articles.length} article(s) to process from ${runId}\n`);

    // Check if middleware is enabled
    if (!CHATGPT_MIDDLEWARE_ENABLED) {
      console.log("⚠️  ChatGPT middleware is disabled - will only log article objects\n");
    }

    // Collect processed articles for saving
    const processedArticles: Array<{
      original: Article;
      processed: ProcessedArticle | null;
    }> = [];

    // Process each article individually
    for (let i = 0; i < data.articles.length; i++) {
      const article = data.articles[i];
      const articleNumber = i + 1;
      
      console.log(`\n${"=".repeat(80)}`);
      console.log(`🔄 Processing article ${articleNumber}/${data.articles.length} from ${runId}`);
      console.log(`📰 Title: ${article.title || "N/A"}`);
      console.log(`🔗 URL: ${article.url}`);
      console.log(`${"=".repeat(80)}\n`);
      
      // Add delay BEFORE processing (except for the first article)
      if (i > 0) {
        const delaySeconds = Math.floor(CHATGPT_REQUEST_DELAY_MS / 1000);
        console.log(`⏳ Waiting ${delaySeconds} second(s) before processing next article (rate limit protection)...\n`);
        await new Promise((resolve) => setTimeout(resolve, CHATGPT_REQUEST_DELAY_MS));
      }

      // Process article through ChatGPT and image service
      const processedArticle = await processArticleWithChatGPT(article);

      if (processedArticle) {
        console.log(`✅ Article processed successfully\n`);
      } else {
        console.log(`❌ Failed to process article\n`);
      }

      // Collect the result (even if null, to track which articles failed)
      processedArticles.push({
        original: article,
        processed: processedArticle,
      });
    }

    // Save processed articles to file for gunner to read
    const processedFilePath = path.join(collectedDir, `[${runId}]processed-articles.json`);
    const processedData = {
      runId,
      processedAt: new Date().toISOString(),
      totalArticles: processedArticles.length,
      articles: processedArticles,
    };
    fs.writeFileSync(processedFilePath, JSON.stringify(processedData, null, 2), "utf-8");
    console.log(`💾 Saved processed articles to: ${path.basename(processedFilePath)}\n`);

    const successCount = processedArticles.filter((item) => item.processed !== null).length;
    console.log("\n" + "=".repeat(80));
    console.log(`✅ Successfully processed ${successCount}/${data.articles.length} article(s) from ${runId}`);
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.log("\n" + "=".repeat(80));
    console.log(`❌ Error processing articles from ${runId}`);
    console.log("=".repeat(80) + "\n");
    logger.error(`❌ Error processing articles from ${runId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
