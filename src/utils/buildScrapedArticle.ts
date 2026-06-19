import { cleanArticleBody } from "../scraping/cleanArticleBody";

export interface ArticleDetailsBase {
  url: string;
  title: string;
  excerpt?: string;
  category?: string | null;
  body?: string;
  publishedAt?: string | null;
}

export interface ScrapedArticleRecord extends ArticleDetailsBase {
  success: boolean;
  sourceKey: string;
  source: string;
  scrapedAt: string;
  publishedAt: string | null;
  body: string;
  error?: string;
  articleItem?: unknown;
}

export function buildScrapedArticleSuccess<T extends ArticleDetailsBase>(
  details: T,
  sourceKey: string,
  articleItem: unknown
): ScrapedArticleRecord & T {
  const cleanedBody = cleanArticleBody(details.body) ?? details.body ?? "";

  return {
    ...details,
    body: cleanedBody,
    publishedAt: details.publishedAt ?? null,
    articleItem,
    sourceKey,
    source: sourceKey,
    scrapedAt: new Date().toISOString(),
    success: true,
  };
}

export function buildScrapedArticleFailure(
  sourceKey: string,
  item: { url: string; title?: string },
  articleItem: unknown,
  error: string
): ScrapedArticleRecord {
  return {
    url: item.url,
    title: item.title || "Unknown",
    excerpt: "",
    category: null,
    body: "",
    publishedAt: null,
    articleItem,
    sourceKey,
    source: sourceKey,
    scrapedAt: new Date().toISOString(),
    success: false,
    error,
  };
}
