/**
 * Pixabay Image Provider
 */

import { logger } from "../../config/logger";
import { ImageResult } from "../types";

const PIXABAY_BASE_URL = "https://pixabay.com/api/";
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

if (!PIXABAY_API_KEY) {
  logger.warn("⚠️ PIXABAY_API_KEY is not set. Pixabay provider will not work.");
}

export interface PixabaySearchOptions {
  perPage?: number;
}

/**
 * Searches Pixabay API for images
 * 
 * @param query - Search query/keyword
 * @param opts - Search options
 * @returns ImageResult or null if no results found
 */
export async function searchPixabay(
  query: string,
  opts?: PixabaySearchOptions
): Promise<ImageResult | null> {
  if (!PIXABAY_API_KEY) {
    logger.debug("Pixabay API key not set, skipping Pixabay search");
    return null;
  }

  // Request at least 3 results to randomly pick from
  const perPage = Math.max(opts?.perPage ?? 5, 3);

  try {
    const url = new URL(PIXABAY_BASE_URL);
    url.searchParams.set("key", PIXABAY_API_KEY);
    url.searchParams.set("q", query);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("safesearch", "true");

    const res = await fetch(url.toString());

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("Pixabay API error:", {
        status: res.status,
        statusText: res.statusText,
        error: errorText,
      });
      return null;
    }

    const data = (await res.json()) as {
      hits?: Array<{
        largeImageURL: string;
        webformatURL: string;
        imageWidth?: number;
        imageHeight?: number;
        user?: string;
        pageURL?: string;
      }>;
    };

    const hits = data.hits || [];
    if (hits.length === 0) {
      logger.debug(`No Pixabay results found for query: ${query}`);
      return null;
    }

    // Randomly pick from the first 3 results (or fewer if less than 3 available)
    const topResults = hits.slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topResults.length);
    const selected = topResults[randomIndex];

    const result: ImageResult = {
      url: selected.largeImageURL,
      thumbUrl: selected.webformatURL,
      width: selected.imageWidth,
      height: selected.imageHeight,
      authorName: selected.user,
      source: "pixabay",
      sourcePageUrl: selected.pageURL,
      license: "Pixabay Content License",
    };

    logger.info(`✅ Pixabay: Found image for "${query}" by ${selected.user || "Unknown"} (randomly selected from ${topResults.length} top results)`);
    return result;
  } catch (error) {
    logger.error("Pixabay API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

