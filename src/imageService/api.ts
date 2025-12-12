/**
 * Image Service API
 * 
 * Main entry point for fetching images using cascade approach
 */

import { ImageResult } from "./types";
import { getArticleImage, GetArticleImageParams } from "./getArticleImage";

/**
 * Fetches image data from image API service using cascade approach
 * 
 * @param imageKeyword - The keyword to search for images
 * @param category - Article category (affects which providers to use)
 * @param keywords - Additional keywords for better search
 * @returns Promise with image service response or null if failed
 */
export async function fetchImageFromService(
  imageKeyword: string,
  category?: string | null,
  keywords?: string[]
): Promise<ImageResult | null> {
  const params: GetArticleImageParams = {
    imageKeyword,
    category,
    keywords,
  };

  return await getArticleImage(params);
}

