/**
 * Image Service - Main Entry Point
 * 
 * Exports all public functions and types for the image service
 */

// Export types
export type {
  ImageSource,
  ChatGPTArticleResponse,
  ImageResult,
  ImageServiceResponse,
  ProcessedArticle,
} from "./types";

// Export orchestrator functions
export {
  parseChatGPTResponse,
  processArticleWithImage,
} from "./orchestrator";

// Export API functions
export { fetchImageFromService } from "./api";

// Export cascade function
export { getArticleImage } from "./getArticleImage";
export type { GetArticleImageParams } from "./getArticleImage";

// Export provider functions (for direct use if needed)
export { searchPexels } from "./providers/pexels";
export { searchPixabay } from "./providers/pixabay";

