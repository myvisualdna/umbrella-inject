/**
 * Script to sync all Sanity data (categories, tags, and authors) at once
 * Run this with: npm run sync-all
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file
const envPath = path.join(process.cwd(), ".env");
const result = dotenv.config({ path: envPath, override: false });

if (result.error) {
  console.error(`❌ Error loading .env file from ${envPath}`);
  console.error(`   ${result.error.message}\n`);
  process.exit(1);
}

import { fetchCategories } from "./categoryFetcher";
import { fetchTags } from "./tagFetcher";
import { fetchAuthors } from "./authorFetcher";

/**
 * Wrapper to catch errors without exiting process
 */
async function safeFetch(
  name: string,
  fetchFn: () => Promise<void>
): Promise<boolean> {
  try {
    await fetchFn();
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to sync ${name}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Syncs all Sanity data (categories, tags, and authors)
 */
async function syncAll(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("🔄 Syncing all Sanity data (categories, tags, and authors)");
  console.log("=".repeat(80) + "\n");

  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  // Sync categories
  console.log("\n" + "─".repeat(80));
  console.log("📂 Step 1/3: Syncing Categories");
  console.log("─".repeat(80) + "\n");
  const categoriesSuccess = await safeFetch("categories", fetchCategories);
  if (categoriesSuccess) {
    successCount++;
  } else {
    failureCount++;
  }

  // Sync tags
  console.log("\n" + "─".repeat(80));
  console.log("🏷️  Step 2/3: Syncing Tags");
  console.log("─".repeat(80) + "\n");
  const tagsSuccess = await safeFetch("tags", fetchTags);
  if (tagsSuccess) {
    successCount++;
  } else {
    failureCount++;
  }

  // Sync authors
  console.log("\n" + "─".repeat(80));
  console.log("👤 Step 3/3: Syncing Authors");
  console.log("─".repeat(80) + "\n");
  const authorsSuccess = await safeFetch("authors", fetchAuthors);
  if (authorsSuccess) {
    successCount++;
  } else {
    failureCount++;
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n" + "=".repeat(80));
  console.log("✅ Sync Complete");
  console.log("=".repeat(80));
  console.log(`📊 Summary: ${successCount} successful, ${failureCount} failed`);
  console.log(`⏱️  Duration: ${duration}s\n`);

  if (failureCount > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncAll()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { syncAll };


