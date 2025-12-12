/**
 * ChatGPT Middleware - Main Entry Point
 * 
 * This module provides the main interface for processing articles through ChatGPT.
 * It exports essential controls (like the middleware switch) and all public functions.
 */

// Re-export configuration (essential controls)
export { CHATGPT_MIDDLEWARE_ENABLED } from "./config";

// Re-export types
export type { Article } from "./types";

// Re-export main processing functions
export { processArticleWithChatGPT, processCollectedArticlesFromRun } from "./processor";

// Re-export utility functions
export { processArticlesWithChatGPT, processCollectedArticlesFromFiles } from "./utils";
