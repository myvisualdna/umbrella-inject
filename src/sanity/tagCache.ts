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
    aliases?: string[];
    category?: {
      _id?: string;
      slug?: string;
      title?: string;
    };
  }>;
}

export interface SanityTagCatalogItem {
  id: string;
  slug: string;
  title: string;
  aliases: string[];
  categoryId: string;
  categorySlug: string;
  categoryTitle: string;
}

export interface TagResolutionResult {
  reference: SanityCategoryReference;
  catalogItem: SanityTagCatalogItem;
}

let tagCatalogCache: SanityTagCatalogItem[] | null = null;
let tagSlugIndex: Map<string, SanityTagCatalogItem> | null = null;

const CACHE_FILE_PATH = path.join(process.cwd(), "src", "utils", "data", "sanity-tags.json");

export function normalizeCategoryKey(category: string | null | undefined): string {
  if (!category) return "";
  return category.trim().toLowerCase();
}

function readTagCacheFile(): TagCacheFile | null {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Tag cache file not found: ${CACHE_FILE_PATH}`);
    logger.warn("Run 'npm run sync-tags' to create the cache file");
    return null;
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: TagCacheFile = JSON.parse(fileContent);
    if (!Array.isArray(data.tags)) {
      logger.warn("Invalid tag cache file format");
      return null;
    }
    return data;
  } catch (error) {
    logger.error("Error loading tag cache:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function parseCatalogItem(tag: TagCacheFile["tags"][number]): SanityTagCatalogItem | null {
  if (!tag._id || !tag.slug) {
    return null;
  }

  const categoryId = tag.category?._id?.trim();
  const categorySlug = tag.category?.slug?.trim();
  const categoryTitle = tag.category?.title?.trim();

  if (!categoryId || !categorySlug || !categoryTitle) {
    logger.warn(
      `Tag "${tag.slug}" excluded from catalog: missing parent category metadata`
    );
    return null;
  }

  return {
    id: tag._id,
    slug: String(tag.slug).toLowerCase().trim(),
    title: String(tag.title ?? tag.slug).trim(),
    aliases: Array.isArray(tag.aliases)
      ? tag.aliases.map((alias) => String(alias).trim()).filter(Boolean)
      : [],
    categoryId,
    categorySlug: categorySlug.toLowerCase().trim(),
    categoryTitle,
  };
}

function loadTagCatalogFromDisk(): SanityTagCatalogItem[] {
  const data = readTagCacheFile();
  if (!data) {
    return [];
  }

  const uncategorizedCount = data.tags.filter(
    (tag) => !tag.category?._id || !tag.category?.slug || !tag.category?.title
  ).length;
  if (uncategorizedCount > 0) {
    logger.warn(
      `${uncategorizedCount} tag(s) in cache are missing category metadata and were excluded`
    );
  }

  return data.tags
    .map(parseCatalogItem)
    .filter((tag): tag is SanityTagCatalogItem => Boolean(tag));
}

function ensureCatalogLoaded(): void {
  if (tagCatalogCache && tagSlugIndex) {
    return;
  }

  tagCatalogCache = loadTagCatalogFromDisk();
  tagSlugIndex = new Map<string, SanityTagCatalogItem>();

  for (const item of tagCatalogCache) {
    tagSlugIndex.set(item.slug, item);
    tagSlugIndex.set(item.title.toLowerCase(), item);
    for (const alias of item.aliases) {
      tagSlugIndex.set(alias.toLowerCase(), item);
    }
  }

  logger.info(`Loaded ${tagCatalogCache.length} category-scoped tags from cache`);
}

function categoryMatches(item: SanityTagCatalogItem, category: string): boolean {
  const normalized = normalizeCategoryKey(category);
  if (!normalized) return false;
  return (
    item.categorySlug === normalized ||
    normalizeCategoryKey(item.categoryTitle) === normalized
  );
}

export function getTagCatalog(): SanityTagCatalogItem[] {
  ensureCatalogLoaded();
  return [...(tagCatalogCache ?? [])];
}

export function getTagsForCategory(category: string): SanityTagCatalogItem[] {
  ensureCatalogLoaded();
  return (tagCatalogCache ?? []).filter((item) => categoryMatches(item, category));
}

export function getAllowedTagSlugsForCategory(category: string): string[] {
  return getTagsForCategory(category).map((tag) => tag.slug);
}

export function findTagCatalogItem(
  tag: string | null | undefined
): SanityTagCatalogItem | undefined {
  if (!tag) {
    return undefined;
  }

  ensureCatalogLoaded();
  const index = tagSlugIndex ?? new Map<string, SanityTagCatalogItem>();

  const tagLower = tag.toLowerCase().trim();
  let item = index.get(tagLower);

  if (!item) {
    const tagSlug = tagLower.replace(/[^\w-]/g, "-");
    item = index.get(tagSlug);
  }

  return item;
}

/**
 * Resolves a tag slug/title to a Sanity reference when it belongs to the given category.
 */
export function resolveTagReferenceForCategory(
  tag: string | null | undefined,
  category: string | null | undefined
): TagResolutionResult | undefined {
  const item = findTagCatalogItem(tag);
  if (!item) {
    if (tag && tag.trim().length > 0) {
      logger.warn(`Tag not found in cache: "${tag}"`);
    }
    return undefined;
  }

  if (!category || !categoryMatches(item, category)) {
    logger.warn(
      `Tag "${tag}" belongs to category "${item.categorySlug}" and cannot be used for "${category ?? "unknown"}"`
    );
    return undefined;
  }

  return {
    reference: {
      _type: "reference",
      _ref: item.id,
      _weak: false,
    },
    catalogItem: item,
  };
}

/**
 * Resolves a tag without category scope (lookup only). Prefer resolveTagReferenceForCategory.
 */
export function resolveTagReference(
  tag: string | null | undefined
): SanityCategoryReference | undefined {
  const item = findTagCatalogItem(tag);
  if (!item) {
    if (tag && tag.trim().length > 0) {
      logger.warn(`Tag not found in cache: "${tag}"`);
    }
    return undefined;
  }

  return {
    _type: "reference",
    _ref: item.id,
    _weak: false,
  };
}

export function resolveTagReferencesForCategory(
  category: string,
  tags: (string | null | undefined)[]
): {
  references: SanityCategoryReference[];
  missingTags: string[];
  mismatchedTags: string[];
} {
  const references: SanityCategoryReference[] = [];
  const missingTags: string[] = [];
  const mismatchedTags: string[] = [];
  const seenRefs = new Set<string>();

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (!tag || tag.trim().length === 0) {
      continue;
    }

    const item = findTagCatalogItem(tag);
    if (!item) {
      missingTags.push(tag);
      continue;
    }

    if (!categoryMatches(item, category)) {
      mismatchedTags.push(tag);
      continue;
    }

    if (seenRefs.has(item.id)) {
      continue;
    }

    seenRefs.add(item.id);
    references.push({
      _type: "reference",
      _ref: item.id,
      _key: `tag-${i}-${item.id.substring(0, 8)}`,
    });
  }

  return { references, missingTags, mismatchedTags };
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

export function getAllowedTagSlugs(): string[] {
  return getTagCatalog().map((tag) => tag.slug);
}

export function clearTagCache(): void {
  tagCatalogCache = null;
  tagSlugIndex = null;
}
