/**
 * ChatGPT API communication functions
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { Article, ChatGPTResponse } from "./types";
import { CHATGPT_API_KEY, CHATGPT_API_URL, CHATGPT_MODEL } from "./config";
import { cleanArticleBody } from "./cleanArticleBody";

/**
 * Loads available tag titles from sanity-tags.json
 * @returns Array of tag title strings
 */
function getAvailableTags(): string[] {
  const tagsFilePath = path.join(process.cwd(), "collected", "sanity-tags.json");

  try {
    if (!fs.existsSync(tagsFilePath)) {
      logger.warn("Tags file not found, ChatGPT will not be able to select tags");
      return [];
    }

    const fileContent = fs.readFileSync(tagsFilePath, "utf-8");
    const data = JSON.parse(fileContent) as {
      tags?: Array<{ title?: string }>;
    };

    if (!data.tags || !Array.isArray(data.tags)) {
      return [];
    }

    return data.tags
      .map((tag) => tag.title)
      .filter((title): title is string => !!title);
  } catch (error) {
    logger.error("Error loading tags for ChatGPT prompt:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Filters article to only include fields needed for ChatGPT processing
 * and pre-cleans the body to remove junk/footer/promo lines.
 */
export function filterArticleForChatGPT(article: Article): {
  title: string;
  excerpt?: string;
  category?: string | null;
  body?: string;
} {
  return {
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    body: cleanArticleBody(article.body),
  };
}

/**
 * Creates a prompt for ChatGPT based on article data
 */
export function createPrompt(article: Article): string {
  const filtered = filterArticleForChatGPT(article);
  const availableTags = getAvailableTags();
  const tagsList = availableTags.length > 0 ? availableTags.join(", ") : "";

  return `Rewrite this article. Output ONLY valid JSON: {"title":"...", "tickerTitle":"...", "excerpt":"...", "body":"...", "imageKeyword":"...", "tags":["tag1","tag2","tag3"]}

Rules: Keep facts/names/dates/quotes accurate. Rewrite with new wording/structure in a neutral news tone. Do not add new info.
Body: remove bylines/author names, publisher/network/agency mentions, and promo/CTA lines.

Limits: title ≤160 chars, tickerTitle ≤45 chars, excerpt ≤160 chars (complete sentences), body ≤650 words (3–4 paragraphs), imageKeyword 1-2 words, tags = exactly 3 strings from: ${tagsList}. If any field exceeds its limit, shorten it to fit.

imageKeyword: Prefer 1–3 words; use 4 only if it’s a single proper name/landmark/organization; MUST appear verbatim in article text. Prefer: Person > Org/Product > Place > Named event > Concrete object. Avoid generic topics/abstract words/verbs/dates; no adjectives unless proper name/model. Output only phrase.


Article:
Title: ${filtered.title}
${filtered.excerpt ? `Excerpt: ${filtered.excerpt}` : ""}
${filtered.category ? `Category: ${filtered.category}` : ""}
Body: ${filtered.body ?? ""}`.trim();
}

/**
 * Creates and returns the request payload sent to ChatGPT.
 *
 * IMPORTANT:
 * In your current setup, gpt-4.1-nano rejects:
 * - max_tokens (expects max_completion_tokens)
 * - temperature values other than default (so we omit temperature entirely)
 */
export function createRequestPayload(article: Article): {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_completion_tokens: number;
} {
  const prompt = createPrompt(article);

  return {
    model: CHATGPT_MODEL, // gpt-4.1-nano
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 1400,
  };
}

/**
 * Sends article to ChatGPT API with retry logic for rate limits
 * + auto-healing for param incompatibilities (token param / temperature).
 */
export async function sendToChatGPT(
  article: Article,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<string | null> {
  if (!CHATGPT_API_KEY) {
    logger.error("ChatGPT API key is not set in environment variables");
    return null;
  }

  let requestPayload: any = createRequestPayload(article);

  // Auto-heal flags (avoid infinite loops)
  let didSwapTokenParam = false;
  let didRemoveTemperature = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post<ChatGPTResponse>(
        CHATGPT_API_URL,
        requestPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CHATGPT_API_KEY}`,
          },
        }
      );

      const choice = response.data.choices?.[0];
      if (!choice) return null;

      if (choice.finish_reason === "length") {
        logger.warn("ChatGPT response truncated (token limit reached)");
      }

      return choice.message.content ?? null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data as any;
        const errorMsg: string | undefined = errorData?.error?.message;
        const errorType = errorData?.error?.type;
        const errorCode = errorData?.error?.code;

        /**
         * Auto-fix #1: Token parameter mismatch
         * Some endpoints/models demand max_completion_tokens vs max_tokens.
         */
        if (
          status === 400 &&
          !didSwapTokenParam &&
          typeof errorMsg === "string" &&
          errorMsg.toLowerCase().includes("unsupported parameter") &&
          (errorMsg.includes("max_tokens") ||
            errorMsg.includes("max_completion_tokens"))
        ) {
          didSwapTokenParam = true;

          const value =
            requestPayload.max_tokens ??
            requestPayload.max_completion_tokens ??
            1400;

          delete requestPayload.max_tokens;
          delete requestPayload.max_completion_tokens;

          if (errorMsg.includes("max_tokens")) {
            requestPayload.max_completion_tokens = value;
            logger.warn(
              "Auto-fix: switched to max_completion_tokens after API rejection"
            );
          } else {
            requestPayload.max_tokens = value;
            logger.warn("Auto-fix: switched to max_tokens after API rejection");
          }

          continue; // retry immediately
        }

        /**
         * Auto-fix #2: temperature not supported (only default 1)
         * We omit temperature by default, but keep this just in case.
         */
        if (
          status === 400 &&
          !didRemoveTemperature &&
          typeof errorMsg === "string" &&
          errorMsg.toLowerCase().includes("temperature")
        ) {
          didRemoveTemperature = true;
          delete requestPayload.temperature;
          logger.warn("Auto-fix: removed temperature after API rejection");
          continue; // retry immediately
        }

        // Quota exceeded
        if (
          status === 429 &&
          (errorType === "insufficient_quota" ||
            errorCode === "insufficient_quota")
        ) {
          logger.error("❌ ChatGPT API quota exceeded");
          console.log("\n" + "=".repeat(80));
          console.log("❌ ChatGPT API Quota Exceeded");
          console.log("=".repeat(80));
          console.log(
            "Please check your billing and plan at: https://platform.openai.com/account/billing"
          );
          console.log("=".repeat(80) + "\n");
          return null;
        }

        // Rate limit retry
        if (status === 429 && attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          logger.warn(
            `Rate limit hit (429), retrying in ${delay}ms (attempt ${
              attempt + 1
            }/${maxRetries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Other errors
        logger.error("ChatGPT API error:", {
          status,
          statusText: error.response?.statusText,
          message: error.message,
          data: errorData,
          attempt: attempt + 1,
        });

        return null;
      }

      // Non-axios error
      logger.error("Unexpected error calling ChatGPT API:", {
        error: error instanceof Error ? error.message : String(error),
        attempt: attempt + 1,
      });

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return null;
}
