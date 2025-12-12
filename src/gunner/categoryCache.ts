/**
 * Category cache management - reads from local JSON file instead of querying Sanity
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { SanityCategoryReference } from "./types";

/**
 * Structure of the categories cache file
 */
interface CategoryCacheFile {
  lastUpdated: string;
  categories: Array<{
    _id: string;
    slug?: string;
    name?: string;
  }>;
}

/**
 * In-memory cache loaded from file
 */
let categoryCache: Map<string, string> | null = null;

/**
 * Path to the categories cache file
 */
const CACHE_FILE_PATH = path.join(process.cwd(), "collected", "sanity-categories.json");

/**
 * Loads categories from the JSON cache file
 * @returns Map of category identifier (slug or name) to document ID
 */
function loadCategoryCache(): Map<string, string> {
  if (categoryCache) {
    return categoryCache;
  }

  categoryCache = new Map<string, string>();

  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Category cache file not found: ${CACHE_FILE_PATH}`);
    logger.warn("Run 'npm run sync-categories' to create the cache file");
    return categoryCache;
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: CategoryCacheFile = JSON.parse(fileContent);

    if (!data.categories || !Array.isArray(data.categories)) {
      logger.warn("Invalid category cache file format");
      return categoryCache;
    }

    // Populate cache with both slug and name mappings
    for (const cat of data.categories) {
      if (cat._id) {
        if (cat.slug) {
          categoryCache.set(cat.slug.toLowerCase().trim(), cat._id);
        }
        if (cat.name) {
          const nameLower = cat.name.toLowerCase().trim();
          categoryCache.set(nameLower, cat._id);
        }
      }
    }

    logger.info(`Loaded ${data.categories.length} categories from cache (updated: ${data.lastUpdated})`);
    return categoryCache;
  } catch (error) {
    logger.error("Error loading category cache:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return categoryCache;
  }
}

/**
 * Resolves a category string to a Sanity category reference using the cache
 * 
 * @param category - Category string (e.g., "us", "world", "politics")
 * @returns Category reference or undefined if not found
 */
export function resolveCategoryReference(
  category: string | null | undefined
): SanityCategoryReference | undefined {
  if (!category) {
    return undefined;
  }

  const cache = loadCategoryCache();

  // Try exact match first
  const categoryLower = category.toLowerCase().trim();
  let categoryId = cache.get(categoryLower);

  // If not found, try slug format (replace spaces/special chars with hyphens)
  if (!categoryId) {
    const categorySlug = categoryLower.replace(/[^\w-]/g, "-");
    categoryId = cache.get(categorySlug);
  }

  if (!categoryId) {
    logger.warn(`Category not found in cache: "${category}"`);
    return undefined;
  }

  return {
    _type: "reference",
    _ref: categoryId,
    _weak: false,
  };
}

/**
 * Gets the path to the category cache file
 */
export function getCategoryCachePath(): string {
  return CACHE_FILE_PATH;
}
