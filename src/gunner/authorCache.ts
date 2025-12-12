/**
 * Author cache management - reads from local JSON file instead of querying Sanity
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { SanityCategoryReference } from "./types";

/**
 * Structure of the authors cache file
 */
interface AuthorCacheFile {
  lastUpdated: string;
  authors: Array<{
    _id: string;
    slug?: string;
    name?: string;
    email?: string;
  }>;
}

/**
 * In-memory cache loaded from file
 */
let authorCache: Map<string, string> | null = null;

/**
 * Path to the authors cache file
 */
const CACHE_FILE_PATH = path.join(process.cwd(), "collected", "sanity-authors.json");

/**
 * Loads authors from the JSON cache file
 * @returns Map of author identifier (slug, name, or email) to document ID
 */
function loadAuthorCache(): Map<string, string> {
  if (authorCache) {
    return authorCache;
  }

  authorCache = new Map<string, string>();

  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Author cache file not found: ${CACHE_FILE_PATH}`);
    logger.warn("Run 'npm run sync-authors' to create the cache file");
    return authorCache;
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: AuthorCacheFile = JSON.parse(fileContent);

    if (!data.authors || !Array.isArray(data.authors)) {
      logger.warn("Invalid author cache file format");
      return authorCache;
    }

    // Populate cache with slug, name, and email mappings
    for (const author of data.authors) {
      if (author._id) {
        if (author.slug) {
          authorCache.set(author.slug.toLowerCase().trim(), author._id);
        }
        if (author.name) {
          const nameLower = author.name.toLowerCase().trim();
          authorCache.set(nameLower, author._id);
        }
        if (author.email) {
          const emailLower = author.email.toLowerCase().trim();
          authorCache.set(emailLower, author._id);
        }
      }
    }

    logger.info(`Loaded ${data.authors.length} authors from cache (updated: ${data.lastUpdated})`);
    return authorCache;
  } catch (error) {
    logger.error("Error loading author cache:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return authorCache;
  }
}

/**
 * Resolves an author string to a Sanity author reference using the cache
 * Can match by slug, name, or email
 * 
 * @param author - Author identifier (slug, name, or email)
 * @returns Author reference or undefined if not found
 */
export function resolveAuthorReference(
  author: string | null | undefined
): SanityCategoryReference | undefined {
  if (!author) {
    return undefined;
  }

  const cache = loadAuthorCache();

  // Try exact match first
  const authorLower = author.toLowerCase().trim();
  let authorId = cache.get(authorLower);

  // If not found, try slug format (replace spaces/special chars with hyphens)
  if (!authorId) {
    const authorSlug = authorLower.replace(/[^\w-]/g, "-");
    authorId = cache.get(authorSlug);
  }

  if (!authorId) {
    logger.warn(`Author not found in cache: "${author}"`);
    return undefined;
  }

  return {
    _type: "reference",
    _ref: authorId,
    _weak: false,
  };
}

/**
 * Gets a random author reference from the cache (excluding specified slug)
 * @param excludeSlug - Slug to exclude from selection (e.g., "andres-n")
 * @returns Random author reference or undefined if no authors available
 */
export function getRandomAuthorReference(
  excludeSlug?: string
): SanityCategoryReference | undefined {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    logger.warn(`Author cache file not found: ${CACHE_FILE_PATH}`);
    return undefined;
  }

  try {
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    const data: AuthorCacheFile = JSON.parse(fileContent);

    if (!data.authors || !Array.isArray(data.authors) || data.authors.length === 0) {
      logger.warn("No authors found in cache");
      return undefined;
    }

    // Filter out excluded author
    const excludeSlugLower = excludeSlug?.toLowerCase().trim();
    const availableAuthors = data.authors.filter((author) => {
      if (!author._id) return false;
      if (excludeSlugLower && author.slug?.toLowerCase().trim() === excludeSlugLower) {
        return false;
      }
      return true;
    });

    if (availableAuthors.length === 0) {
      logger.warn(`No authors available after excluding "${excludeSlug}"`);
      return undefined;
    }

    // Pick a random author
    const randomIndex = Math.floor(Math.random() * availableAuthors.length);
    const selectedAuthor = availableAuthors[randomIndex];

    return {
      _type: "reference",
      _ref: selectedAuthor._id,
      _weak: false,
    };
  } catch (error) {
    logger.error("Error getting random author:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Gets the path to the author cache file
 */
export function getAuthorCachePath(): string {
  return CACHE_FILE_PATH;
}


