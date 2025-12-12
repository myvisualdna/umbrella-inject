/**
 * Core logic to send articles to Sanity CMS
 */

import { getSanityClient } from "./client";
import { SanityPostDocument } from "./types";
import { logger } from "../config/logger";

/**
 * Sends a single post to Sanity CMS using upsert (create or replace)
 * 
 * @param post - Sanity post document to send
 * @returns true if successful, false otherwise
 */
export async function sendArticleToSanity(
  post: SanityPostDocument
): Promise<boolean> {
  const client = getSanityClient();
  if (!client) {
    logger.error("Sanity client not initialized - cannot send article");
    return false;
  }

  // Ensure _id is set (required for createOrReplace)
  if (!post._id) {
    logger.error("Post document missing _id - cannot send to Sanity");
    return false;
  }

  // Ensure category is set (required field)
  if (!post.category) {
    logger.error("Post document missing category - cannot send to Sanity");
    return false;
  }

  try {
    console.log(`📤 Sending post to Sanity CMS`);
    console.log(`📰 Title: ${post.title}`);
    console.log(`🔗 Slug: ${post.slug.current}\n`);

    // Use createOrReplace to upsert by document ID
    // This will create a new document if it doesn't exist, or replace if it does
    // Type assertion needed because createOrReplace expects _id to be required
    await client.createOrReplace({
      ...post,
      _id: post._id,
    } as SanityPostDocument & { _id: string; category: NonNullable<SanityPostDocument["category"]> });

    console.log(`✅ Successfully sent post to Sanity: ${post.slug.current}\n`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to send post to Sanity: ${post.slug.current}\n`);
    logger.error(`Failed to send post to Sanity:`, {
      postId: post._id,
      slug: post.slug.current,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}
