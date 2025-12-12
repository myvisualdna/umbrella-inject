/**
 * Type definitions for ChatGPT Middleware
 */

/**
 * Interface for article data
 */
export interface Article {
  url: string;
  title: string;
  excerpt?: string;
  body?: string;
  category?: string | null;
  origin?: string;
  [key: string]: any;
}

/**
 * Interface for ChatGPT API response
 */
export interface ChatGPTResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interface for collected articles JSON file structure
 */
export interface CollectedArticlesFile {
  runId: string;
  collectedAt: string;
  totalArticles: number;
  articles: Article[];
}
