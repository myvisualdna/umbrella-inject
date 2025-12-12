/**
 * Script to fetch tags from Sanity and save to local JSON cache file
 * Run this with: npm run sync-tags
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file
// Explicitly load from project root
const envPath = path.join(process.cwd(), ".env");
const result = dotenv.config({ path: envPath, override: false });

if (result.error) {
  console.error(`❌ Error loading .env file from ${envPath}`);
  console.error(`   ${result.error.message}\n`);
  process.exit(1);
} else if (result.parsed) {
  console.log(`✅ Loaded .env file from ${envPath}`);
  console.log(`   Found ${Object.keys(result.parsed).length} environment variables\n`);
}

import { getSanityClient } from "../gunner/client";
import { logger } from "../config/logger";
import { getTagCachePath } from "../gunner/tagCache";

/**
 * Fetches all tags from Sanity and saves them to a JSON file
 */
async function fetchTags(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("🔄 Fetching tags from Sanity CMS");
  console.log("=".repeat(80) + "\n");

  // Debug: Show which environment variables are loaded
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN;
  
  if (!projectId || !token) {
    const errorMsg = "Missing required environment variables";
    console.log(`❌ ${errorMsg}:\n`);
    console.log(`   NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_PROJECT_ID: ${projectId ? "✅ Set" : "❌ Missing"}`);
    console.log(`   NEXT_PUBLIC_SANITY_DATASET or SANITY_DATASET: ${dataset ? `✅ Set (${dataset})` : "⚠️  Using default: production"}`);
    console.log(`   SANITY_API_WRITE_TOKEN or SANITY_API_TOKEN: ${token ? "✅ Set" : "❌ Missing"}`);
    console.log("\n💡 Make sure your .env file contains these variables.\n");
    if (require.main === module) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  console.log(`✅ Environment variables loaded:`);
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Dataset: ${dataset || "production"}`);
  console.log(`   Token: ${token.substring(0, 10)}...\n`);

  const client = getSanityClient();
  if (!client) {
    const errorMsg = "Sanity client not initialized. Check your environment variables.";
    console.log(`❌ ${errorMsg}\n`);
    if (require.main === module) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  try {
    // Query all tags from Sanity
    const query = `*[_type == "tag"]{
      _id,
      "slug": slug.current,
      title
    } | order(title asc)`;
    
    console.log("📡 Querying Sanity for tags...\n");
    const tags = await client.fetch(query);

    if (!tags || tags.length === 0) {
      console.log("⚠️  No tags found in Sanity\n");
      return;
    }

    // Prepare cache data
    const cacheData = {
      lastUpdated: new Date().toISOString(),
      tags: tags.map((tag: any) => ({
        _id: tag._id,
        slug: tag.slug || undefined,
        title: tag.title || undefined,
      })),
    };

    // Ensure collected directory exists
    const collectedDir = path.join(process.cwd(), "collected");
    if (!fs.existsSync(collectedDir)) {
      fs.mkdirSync(collectedDir, { recursive: true });
    }

    // Save to JSON file
    const cachePath = getTagCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    console.log(`✅ Successfully fetched ${tags.length} tags`);
    console.log(`📄 Saved to: ${cachePath}\n`);

    // Display tags
    console.log("📋 Tags found:\n");
    tags.forEach((tag: any, index: number) => {
      const slug = tag.slug ? ` (slug: ${tag.slug})` : "";
      console.log(`  ${index + 1}. ${tag.title || "Unnamed"}${slug} - ID: ${tag._id}`);
    });
    console.log("\n");

    logger.info(`Fetched ${tags.length} tags from Sanity`);
  } catch (error) {
    console.log("\n❌ Error fetching tags:\n");
    logger.error("Error fetching tags:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Only exit if running as main module
    if (require.main === module) {
      process.exit(1);
    }
    throw error; // Re-throw if imported
  }
}

// Run if called directly
if (require.main === module) {
  fetchTags()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { fetchTags };
