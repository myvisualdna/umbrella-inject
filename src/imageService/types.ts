/**
 * Type definitions for Image Service
 */

/**
 * Image source provider types
 */
export type ImageSource = "wikimedia" | "pexels" | "pixabay";

/**
 * Response from ChatGPT containing rewritten article with imageKeyword and tickerTitle
 */
export interface ChatGPTArticleResponse {
  title: string;
  tickerTitle: string; // Short version for ticker (max 45 characters)
  excerpt: string;
  body: string;
  imageKeyword: string;
  tags: string[]; // Array of 3 tag strings selected from available tags
}

/**
 * Image result from any image provider
 */
export interface ImageResult {
  url: string; // Full-res URL
  thumbUrl?: string; // Thumbnail / smaller size
  width?: number;
  height?: number;

  // Attribution / metadata
  authorName?: string;
  authorUrl?: string;
  source: ImageSource;
  sourcePageUrl?: string; // Page on Pexels/Pixabay/Wikimedia Commons
  license?: string; // e.g. "CC BY 4.0", "Pexels License", etc.
  
  // Wikimedia Commons specific fields
  imageDescription?: string; // For alt text and epigraph
  artist?: string; // For creditAuthor
  attribution?: string; // For creditProvider
  licenseShortName?: string; // For creditLicense (e.g., "CC BY-SA 3.0")
}

/**
 * Alias for ImageResult (for backward compatibility)
 */
export type ImageServiceResponse = ImageResult;

/**
 * Final processed article with image data merged
 */
export interface ProcessedArticle {
  title: string;
  tickerTitle: string; // Short version for ticker (from ChatGPT)
  excerpt: string;
  category?: string | null;
  body: string;
  imageKeyword: string;
  tags: string[]; // Array of tag strings from ChatGPT
  image: ImageResult | null;
}

