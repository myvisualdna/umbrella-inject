/**
 * Cascade Image Search Logic
 * 
 * Implements a cascade approach:
 * 1. Try Wikimedia Commons first
 * 2. Fallback to Pexels if Wikimedia fails
 * 3. Fallback to Pixabay if Pexels fails
 */

import { logger } from "../config/logger";
import { ImageResult } from "./types";
import { searchWikimedia } from "./providers/wikimedia";
import { searchPexels } from "./providers/pexels";
import { searchPixabay } from "./providers/pixabay";

export interface GetArticleImageParams {
  imageKeyword: string;
  category?: string | null;
  // Extra keywords for better search (not currently used)
  keywords?: string[];
}

/**
 * Builds search query from parameters
 * Only uses imageKeyword
 */
function buildSearchQuery(params: GetArticleImageParams): string {
  // Only use imageKeyword for the search query
  return params.imageKeyword.trim();
}

/**
 * Main cascade function to get article image
 * 
 * Flow:
 * 1. Try Wikimedia Commons first
 * 2. Fallback to Pexels if Wikimedia fails
 * 3. Fallback to Pixabay if Pexels fails
 * 
 * @param params - Search parameters
 * @returns ImageResult or null if no image found
 */
export async function getArticleImage(
  params: GetArticleImageParams
): Promise<ImageResult | null> {
  const query = buildSearchQuery(params);
  
  if (!query) {
    logger.warn("Empty search query, cannot search for images");
    return null;
  }

  // Try Wikimedia Commons first
  const wikimedia = await searchWikimedia(query, { perPage: 5 });
  if (wikimedia) {
    return wikimedia;
  }

  // Fallback to Pexels
  const pexels = await searchPexels(query, { perPage: 5 });
  if (pexels) {
    return pexels;
  }

  // Fallback to Pixabay
  const pixabay = await searchPixabay(query, { perPage: 5 });
  if (pixabay) {
    return pixabay;
  }

  // Nothing found
  logger.warn(`❌ No image found for query: "${query}" after trying all providers`);
  return null;
}

