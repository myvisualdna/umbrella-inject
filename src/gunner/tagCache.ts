/**
 * Tag cache management - reads from local JSON file instead of querying Sanity
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { SanityCategoryReference } from "./types";

/**
 * Structure of the tags cache file
 */
interface TagCacheFile {
  lastUpdated: string;
  tags: Array<{
    _id: string;
    slug?: string;
    title?: string;
  }>;
}

/**
 * In-memory cache loaded from file
 */
let tagCache: Map<string, string> | null = null;

/**
 * Path to the tags cache file
 */
const CACHE_FILE_PATH = path.join(process.cwd(), "collected", "sanity-tags.json");

/**
 * Loads tags from the JSON cache file
 * @returns Map of tag identifier (slug or title) to document ID
 */
function loadTagCache(): Map<string, string> {
  if (tagCache) {
    return tagCache;
  }

  tagCache = new Map<string, string>();

  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Tag cache file not found: ${CACHE_FILE_PATH}`);
    logger.warn("Run 'npm run sync-tags' to create the cache file");
    return tagCache;
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: TagCacheFile = JSON.parse(fileContent);

    if (!data.tags || !Array.isArray(data.tags)) {
      logger.warn("Invalid tag cache file format");
      return tagCache;
    }

    // Populate cache with both slug and title mappings
    for (const tag of data.tags) {
      if (tag._id) {
        if (tag.slug) {
          tagCache.set(tag.slug.toLowerCase().trim(), tag._id);
        }
        if (tag.title) {
          const titleLower = tag.title.toLowerCase().trim();
          tagCache.set(titleLower, tag._id);
        }
      }
    }

    logger.info(`Loaded ${data.tags.length} tags from cache (updated: ${data.lastUpdated})`);
    return tagCache;
  } catch (error) {
    logger.error("Error loading tag cache:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return tagCache;
  }
}

/**
 * Resolves a tag string to a Sanity tag reference using the cache
 * 
 * @param tag - Tag string (e.g., "breaking", "analysis", "opinion")
 * @returns Tag reference or undefined if not found
 */
export function resolveTagReference(
  tag: string | null | undefined
): SanityCategoryReference | undefined {
  if (!tag) {
    return undefined;
  }

  const cache = loadTagCache();

  // Try exact match first
  const tagLower = tag.toLowerCase().trim();
  let tagId = cache.get(tagLower);

  // If not found, try slug format (replace spaces/special chars with hyphens)
  if (!tagId) {
    const tagSlug = tagLower.replace(/[^\w-]/g, "-");
    tagId = cache.get(tagSlug);
  }

  if (!tagId) {
    logger.warn(`Tag not found in cache: "${tag}"`);
    return undefined;
  }

  return {
    _type: "reference",
    _ref: tagId,
    _weak: false,
  };
}

/**
 * Resolves multiple tag strings to Sanity tag references
 * 
 * @param tags - Array of tag strings
 * @returns Array of tag references with _key properties (only includes found tags)
 */
export function resolveTagReferences(
  tags: (string | null | undefined)[]
): SanityCategoryReference[] {
  const references: SanityCategoryReference[] = [];
  
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const ref = resolveTagReference(tag);
    if (ref) {
      // Add _key property required by Sanity for array items
      // Use a combination of index and ref ID to ensure uniqueness
      references.push({
        ...ref,
        _key: `tag-${i}-${ref._ref.substring(0, 8)}`,
      });
    }
  }
  
  return references;
}

/**
 * Gets the path to the tag cache file
 */
export function getTagCachePath(): string {
  return CACHE_FILE_PATH;
}
