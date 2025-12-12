/**
 * Image Service Orchestrator
 * 
 * Orchestrates the flow of:
 * 1. Parsing ChatGPT response to extract imageKeyword
 * 2. Calling image service API with the keyword
 * 3. Merging the image data with the ChatGPT response
 */

import { logger } from "../config/logger";
import { ChatGPTArticleResponse, ImageServiceResponse, ProcessedArticle } from "./types";
import { fetchImageFromService } from "./api";
import { validateChatGPTOutput } from "./validator";
import { enforceOutputLimits } from "./enforceLimits";

/**
 * Parses ChatGPT JSON response string into structured object
 * 
 * @param responseText - The raw text response from ChatGPT
 * @returns Parsed ChatGPT response or null if parsing fails
 */
export function parseChatGPTResponse(
  responseText: string
): ChatGPTArticleResponse | null {
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error("No JSON found in ChatGPT response");
      return null;
    }

    let parsed = JSON.parse(jsonMatch[0]) as ChatGPTArticleResponse;

    // Enforce output limits (trim fields that exceed limits)
    // This prevents losing good rewrites due to minor length issues
    parsed = enforceOutputLimits(parsed) as ChatGPTArticleResponse;

    // Ensure tickerTitle exists (fallback to truncated title if missing)
    // Note: enforceOutputLimits handles length, but we need to ensure it exists
    if (!parsed.tickerTitle) {
      logger.warn("ChatGPT response missing tickerTitle, using truncated title as fallback");
      parsed.tickerTitle = parsed.title.length > 45 ? parsed.title.substring(0, 42) + "..." : parsed.title;
    }

    // Validate against JSON schema after enforcing limits
    if (!validateChatGPTOutput(parsed)) {
      logger.error("ChatGPT response failed JSON schema validation after enforcing limits");
      return null;
    }

    return parsed;
  } catch (error) {
    logger.error("Failed to parse ChatGPT response:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Orchestrates the complete flow:
 * 1. Parses ChatGPT response
 * 2. Fetches image using imageKeyword
 * 3. Merges results into final processed article
 * 
 * @param chatGPTResponse - Raw text response from ChatGPT
 * @param originalCategory - Category from the original article
 * @returns Processed article with image data merged, or null if processing fails
 */
export async function processArticleWithImage(
  chatGPTResponse: string,
  originalCategory?: string | null
): Promise<ProcessedArticle | null> {
  // Step 1: Parse ChatGPT response
  logger.debug("Parsing ChatGPT response...");
  const parsedResponse = parseChatGPTResponse(chatGPTResponse);
  if (!parsedResponse) {
    logger.error("Failed to parse ChatGPT response", {
      responseLength: chatGPTResponse?.length || 0,
      responsePreview: chatGPTResponse?.substring(0, 200) || "empty",
    });
    console.log("❌ Failed to parse ChatGPT response - cannot extract imageKeyword\n");
    console.log(`Response preview: ${chatGPTResponse?.substring(0, 200) || "empty"}...\n`);
    return null;
  }
  
  logger.debug("ChatGPT response parsed successfully", {
    hasTitle: !!parsedResponse.title,
    hasTickerTitle: !!parsedResponse.tickerTitle,
    hasExcerpt: !!parsedResponse.excerpt,
    hasBody: !!parsedResponse.body,
    hasImageKeyword: !!parsedResponse.imageKeyword,
    tagsCount: parsedResponse.tags?.length || 0,
  });

  // Step 2: Fetch image using imageKeyword
  console.log("🖼️  Image search started");
  console.log(`🔍 Searching for image keyword: "${parsedResponse.imageKeyword}"\n`);

  const imageData = await fetchImageFromService(
    parsedResponse.imageKeyword,
    originalCategory
  );
  
  if (!imageData) {
    console.log("❌ No image found\n");
    logger.warn(`Failed to fetch image for keyword: ${parsedResponse.imageKeyword}`);
  }

  // Step 3: Merge results
  const processedArticle: ProcessedArticle = {
    title: parsedResponse.title,
    tickerTitle: parsedResponse.tickerTitle || parsedResponse.title.substring(0, 45), // Fallback if ChatGPT doesn't provide it
    excerpt: parsedResponse.excerpt,
    category: originalCategory || null,
    body: parsedResponse.body,
    imageKeyword: parsedResponse.imageKeyword,
    tags: parsedResponse.tags || [], // Array of tag strings from ChatGPT
    image: imageData,
  };

  return processedArticle;
}

