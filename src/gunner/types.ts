/**
 * Type definitions for Sanity CMS Gunner
 */

import { ProcessedArticle } from "../imageService/types";
import { Article } from "../middleware/types";

/**
 * Portable text block structure (Sanity block content)
 */
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style?: string;
  children: Array<{
    _type: "span";
    _key: string;
    text: string;
    marks?: string[];
  }>;
  markDefs?: any[];
}

/**
 * Sanity cover image structure (matches post schema)
 */
export interface SanityCover {
  source: "asset" | "external";
  externalUrl?: string;
  image?: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
    alt?: string;
  };
  alt?: string;
  epigraph?: string;
  // Credit/attribution fields (for Wikimedia Commons compliance)
  creditProvider?: string;
  creditAuthor?: string;
  creditSourceUrl?: string;
  creditLicense?: string;
}

/**
 * Sanity category reference
 */
export interface SanityCategoryReference {
  _type: "reference";
  _ref: string;
  _weak?: boolean;
  _key?: string; // Required for array items in Sanity
}

/**
 * Sanity SEO object structure
 */
export interface SanitySEO {
  title?: string;
  description?: string;
  // Other SEO fields can be added here if needed
}

/**
 * Sanity post document structure (matches post schema)
 */
export interface SanityPostDocument {
  _id?: string;
  _type: "post";
  
  // Required fields we can fill
  title: string;
  tickerTitle: string; // Short version (max 40 chars)
  excerpt?: string;
  bodyTextOne: PortableTextBlock[]; // Array of blocks (portable text)
  slug: {
    _type: "slug";
    current: string;
  };
  category: SanityCategoryReference; // Reference to category document
  
  // Cover image
  cover?: SanityCover;
  
  // Tags (array of tag references)
  tags?: SanityCategoryReference[]; // Array of tag references (from ChatGPT response)
  
  // Dates
  date: string; // ISO datetime string
  publishedAt?: string; // ISO datetime string
  status: "draft" | "scheduled" | "published";
  
  // Optional fields we can set defaults for
  featured?: boolean;
  priority?: number;
  author?: SanityCategoryReference; // Author reference
  readTime?: number; // Estimated read time in minutes
  seo?: SanitySEO; // SEO object with title and description
  
  // Editorial positioning flags (set via editorialConfig)
  mainHeadline?: boolean;
  mainHeadlineRank?: number; // 0-10, only used when mainHeadline is true
  mainHeadlineUntil?: string; // ISO datetime string, only used when mainHeadline is true
  frontline?: boolean;
  frontRank?: number; // 0-10, only used when frontline is true
  frontUntil?: string; // ISO datetime string, only used when frontline is true
  rightHeadline?: boolean;
  rightHeadlineRank?: number; // 0-10, only used when rightHeadline is true
  rightHeadlineUntil?: string; // ISO datetime string, only used when rightHeadline is true
  justIn?: boolean;
  justInRank?: number; // 0-10, only used when justIn is true
  justInUntil?: string; // ISO datetime string, only used when justIn is true
  breakingNews?: boolean; // Only used when justIn is true
  developingStory?: boolean; // Only used when justIn is true
  
  // Fields we CANNOT fill (will be undefined/null)
  // - bodyBlocks: array of content blocks
  // - updatedAt: datetime (not filled by default)
  // - viewsAll, views30d, views7d: numbers (not filled by default, leave alone)
  // - labels: array of internal labels (none by default, user will modify manually)
  // - etc.
}

/**
 * Processed article with original article data for mapping
 */
export interface ProcessedArticleWithOriginal {
  processed: ProcessedArticle;
  original: Article;
}
