/**
 * Sanity Client Setup
 */

import { createClient } from "@sanity/client";
import { logger } from "../config/logger";
import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_TOKEN } from "./config";

let sanityClient: ReturnType<typeof createClient> | null = null;

/**
 * Initializes and returns the Sanity client
 * @returns Sanity client instance or null if initialization fails
 */
export function getSanityClient() {
  if (sanityClient) {
    return sanityClient;
  }

  if (!SANITY_PROJECT_ID) {
    logger.error("SANITY_PROJECT_ID is not set in environment variables");
    return null;
  }

  if (!SANITY_API_TOKEN) {
    logger.error("SANITY_API_TOKEN is not set in environment variables");
    return null;
  }

  try {
    sanityClient = createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      token: SANITY_API_TOKEN,
      useCdn: false, // Use CDN for reads, but not for writes
      apiVersion: "2024-01-01", // Use current date for API version
    });

    logger.info("✅ Sanity client initialized successfully");
    return sanityClient;
  } catch (error) {
    logger.error("Failed to initialize Sanity client:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
