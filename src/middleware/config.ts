/**
 * Configuration for ChatGPT Middleware
 */

/**
 * Middleware switch - set to true to enable ChatGPT processing, false to disable
 */
export const CHATGPT_MIDDLEWARE_ENABLED = process.env.CHATGPT_MIDDLEWARE_ENABLED === "true";

/**
 * ChatGPT API configuration
 */
export const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY || "";
export const CHATGPT_API_URL = "https://api.openai.com/v1/chat/completions";
export const CHATGPT_MODEL = process.env.CHATGPT_MODEL || "gpt-4o-mini";

/**
 * Delay between ChatGPT requests in milliseconds
 * Default: 60000ms (60 seconds) to stay well under 3 RPM limit
 * Set via CHATGPT_REQUEST_DELAY_MS environment variable
 */
export const CHATGPT_REQUEST_DELAY_MS = parseInt(
  process.env.CHATGPT_REQUEST_DELAY_MS || "60000",
  10
);
