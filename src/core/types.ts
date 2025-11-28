export type SourceId = "apNewsUS" | "yahooNewsUS" | "cbsUS";

export interface RawArticle {
  sourceId: SourceId;
  url: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl?: string;
  category: string;
  publishedAt?: string;
}

export interface RewrittenArticle extends RawArticle {
  rewrittenTitle: string;
  rewrittenExcerpt: string;
  rewrittenBody: string;
}

export interface SanityPostPayload {
  _type: "post";
  title: string;
  slug: { _type: "slug"; current: string };
  excerpt: string;
  body: string;
  mainImage?: {
    _type: "image";
    asset: { _type: "reference"; _ref: string };
  };
  category?: { _type: "reference"; _ref: string } | null;
  sourceUrl: string;
  originalSourceId: string;
  publishedAt?: string;
}

