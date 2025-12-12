/**
 * Orchestrates reading processed articles and sending them to Sanity CMS
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { SANITY_GUNNER_ENABLED } from "./config";
import { ProcessedArticle } from "../imageService/types";
import { Article } from "../middleware/types";
import { mapProcessedArticleToSanity } from "./mapper";
import { sendArticleToSanity } from "./sender";
import { resolveCategoryReference } from "./categoryCache";
import { getRandomAuthorReference } from "./authorCache";

/**
 * Structure of processed articles JSON file
 */
interface ProcessedArticlesFile {
  runId: string;
  processedAt: string;
  totalArticles: number;
  articles: Array<{
    original: Article;
    processed: ProcessedArticle | null;
  }>;
}

/**
 * Sends processed articles from a run to Sanity CMS
 * 
 * @param runId - The run ID (e.g., "run1", "run2", "run3", "run4")
 */
export async function sendProcessedArticlesToSanity(runId: string): Promise<void> {
  if (!SANITY_GUNNER_ENABLED) {
    console.log("\n" + "=".repeat(80));
    console.log("⚠️  Sanity Gunner is disabled - skipping Sanity CMS upload");
    console.log("=".repeat(80) + "\n");
    return;
  }

  const collectedDir = path.join(process.cwd(), "collected");
  const processedFilePath = path.join(collectedDir, `[${runId}]processed-articles.json`);

  if (!fs.existsSync(processedFilePath)) {
    logger.warn(`⚠️  Processed articles file not found: ${processedFilePath}`);
    console.log(`\n⚠️  No processed articles found for ${runId} - skipping Sanity upload\n`);
    return;
  }

  try {
    console.log("\n" + "=".repeat(80));
    console.log(`🚀 Sanity Gunner - Starting upload for ${runId}`);
    console.log(`📄 File: ${path.basename(processedFilePath)}`);
    console.log("=".repeat(80) + "\n");

    // Read the processed articles file
    const fileContent = fs.readFileSync(processedFilePath, "utf-8");
    const data: ProcessedArticlesFile = JSON.parse(fileContent);

    if (!data.articles || !Array.isArray(data.articles)) {
      logger.warn(`⚠️  File ${path.basename(processedFilePath)} does not contain a valid articles array`);
      return;
    }

    if (data.articles.length === 0) {
      console.log(`ℹ️  No processed articles to send to Sanity for ${runId}\n`);
      return;
    }

    // Filter articles that were successfully processed
    const processedArticles = data.articles.filter(
      (item) => item.processed !== null
    );

    if (processedArticles.length === 0) {
      console.log(`⚠️  No successfully processed articles found for ${runId} - skipping Sanity upload\n`);
      return;
    }

    console.log(`📊 Found ${processedArticles.length} processed article(s) to send to Sanity\n`);

    let successCount = 0;
    let failureCount = 0;

    // Send each processed article to Sanity
    for (let i = 0; i < processedArticles.length; i++) {
      const { original, processed } = processedArticles[i];
      
      if (!processed) {
        continue; // Skip if not processed (shouldn't happen due to filter above)
      }

      const articleNumber = i + 1;
      console.log(`\n${"=".repeat(80)}`);
      console.log(`📤 Sending article ${articleNumber}/${processedArticles.length} to Sanity`);
      console.log(`📰 Title: ${processed.title || "N/A"}`);
      console.log(`${"=".repeat(80)}\n`);

      try {
        // Resolve category reference first
        const categoryRef = await resolveCategoryReference(processed.category || original.category);
        
        if (!categoryRef) {
          console.log(`⚠️  Skipping article: Category "${processed.category || original.category}" not found in Sanity\n`);
          failureCount++;
          continue;
        }

        // Get random author (excluding andres-n)
        const authorRef = getRandomAuthorReference("andres-n");
        if (authorRef) {
          console.log(`👤 Assigned random author: ${authorRef._ref}`);
        } else {
          console.log(`⚠️  No author assigned (no authors available in cache)`);
        }

        // Map processed article to Sanity document structure
        // Default to "published" status
        // Pass runId to mapper so it can apply editorial flags from config
        const sanityDoc = mapProcessedArticleToSanity(processed, original, categoryRef, authorRef, runId, {
          status: "published", // Default to published
          featured: false,
          priority: 0,
        });

        // Send to Sanity
        const success = await sendArticleToSanity(sanityDoc);

        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Add a small delay between requests to avoid rate limiting
        if (i < processedArticles.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
        }
      } catch (error) {
        failureCount++;
        logger.error(`Error processing article ${articleNumber} for Sanity:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log(`✅ Sanity Gunner - Upload complete for ${runId}`);
    console.log(`📊 Summary: ${successCount} sent successfully, ${failureCount} failed`);
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.log("\n" + "=".repeat(80));
    console.log(`❌ Error sending articles to Sanity for ${runId}`);
    console.log("=".repeat(80) + "\n");
    logger.error(`❌ Error sending articles to Sanity for ${runId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
