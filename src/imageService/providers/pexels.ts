/**
 * Pexels Image Provider
 */

import { logger } from "../../config/logger";
import { ImageResult } from "../types";

const PEXELS_BASE_URL = "https://api.pexels.com/v1/search";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

if (!PEXELS_API_KEY) {
  logger.warn("⚠️ PEXELS_API_KEY is not set. Pexels provider will not work.");
}

export interface PexelsSearchOptions {
  perPage?: number;
}

/**
 * Searches Pexels API for images
 * 
 * @param query - Search query/keyword
 * @param opts - Search options
 * @returns ImageResult or null if no results found
 */
export async function searchPexels(
  query: string,
  opts?: PexelsSearchOptions
): Promise<ImageResult | null> {
  if (!PEXELS_API_KEY) {
    logger.debug("Pexels API key not set, skipping Pexels search");
    return null;
  }

  // Request at least 3 results to randomly pick from
  const perPage = Math.max(opts?.perPage ?? 5, 3);

  try {
    const url = new URL(PEXELS_BASE_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("Pexels API error:", {
        status: res.status,
        statusText: res.statusText,
        error: errorText,
      });
      return null;
    }

    const data = (await res.json()) as {
      photos?: Array<{
        src: {
          original: string;
          large?: string;
          medium?: string;
          small?: string;
        };
        width?: number;
        height?: number;
        photographer?: string;
        photographer_url?: string;
        url?: string;
      }>;
    };

    const photos = data.photos || [];
    if (photos.length === 0) {
      logger.debug(`No Pexels results found for query: ${query}`);
      return null;
    }

    // Randomly pick from the first 3 results (or fewer if less than 3 available)
    const topResults = photos.slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topResults.length);
    const selected = topResults[randomIndex];

    const result: ImageResult = {
      url: selected.src.original,
      thumbUrl: selected.src.medium ?? selected.src.large ?? selected.src.small,
      width: selected.width,
      height: selected.height,
      authorName: selected.photographer,
      authorUrl: selected.photographer_url,
      source: "pexels",
      sourcePageUrl: selected.url,
      license: "Pexels License",
    };

    logger.info(`✅ Pexels: Found image for "${query}" by ${selected.photographer || "Unknown"} (randomly selected from ${topResults.length} top results)`);
    return result;
  } catch (error) {
    logger.error("Pexels API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

