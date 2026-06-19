/**
 * Tag cache management - reads from local JSON file instead of querying Sanity
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { SanityCategoryReference } from "./types";

interface TagCacheFile {
  lastUpdated: string;
  tags: Array<{
    _id: string;
    slug?: string;
    title?: string;
  }>;
}

export interface SanityTagCatalogItem {
  id: string;
  slug: string;
  title: string;
}

let tagCache: Map<string, string> | null = null;

const CACHE_FILE_PATH = path.join(process.cwd(), "src", "utils", "data", "sanity-tags.json");

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

export function resolveTagReference(
  tag: string | null | undefined
): SanityCategoryReference | undefined {
  if (!tag) {
    return undefined;
  }

  const cache = loadTagCache();

  const tagLower = tag.toLowerCase().trim();
  let tagId = cache.get(tagLower);

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

export function resolveTagReferences(
  tags: (string | null | undefined)[]
): SanityCategoryReference[] {
  const references: SanityCategoryReference[] = [];

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const ref = resolveTagReference(tag);
    if (ref) {
      references.push({
        ...ref,
        _key: `tag-${i}-${ref._ref.substring(0, 8)}`,
      });
    }
  }

  return references;
}

export function getTagCachePath(): string {
  return CACHE_FILE_PATH;
}

export function getTagCatalog(): SanityTagCatalogItem[] {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Tag cache file not found: ${CACHE_FILE_PATH}`);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: TagCacheFile = JSON.parse(fileContent);
    if (!Array.isArray(data.tags)) {
      return [];
    }

    return data.tags
      .filter((tag) => Boolean(tag._id && tag.slug))
      .map((tag) => ({
        id: tag._id,
        slug: String(tag.slug).toLowerCase().trim(),
        title: String(tag.title ?? tag.slug).trim(),
      }))
      .filter((tag) => tag.slug.length > 0);
  } catch (error) {
    logger.error("Error reading tag catalog:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function getAllowedTagSlugs(): string[] {
  return getTagCatalog().map((tag) => tag.slug);
}

export function clearTagCache(): void {
  tagCache = null;
}
