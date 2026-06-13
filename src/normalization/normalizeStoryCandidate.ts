import { getSourceMetadata, resolveSourceKey } from "./sourceMetadata";
import type { NormalizedStoryCandidate, RawScrapedArticle } from "./types";

const TRACKING_QUERY_PARAMS = new Set([
  "ocid",
  "fr",
  "guccounter",
  "guce_referrer",
  "guce_referrer_sig",
]);

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toIsoOrNull(raw?: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    let canonical = parsed.toString();
    if (canonical.endsWith("/")) {
      canonical = canonical.slice(0, -1);
    }
    return canonical;
  } catch {
    return rawUrl.trim();
  }
}

export function normalizeStoryCandidate(
  raw: RawScrapedArticle,
  fallbackSourceKey?: string
): NormalizedStoryCandidate {
  const rawSourceKey = String(raw.sourceKey ?? raw.source ?? fallbackSourceKey ?? "").trim();
  const sourceKey = resolveSourceKey(rawSourceKey) ?? rawSourceKey;
  const metadata = getSourceMetadata(sourceKey);

  const title = String(raw.title ?? "").trim();
  const body = String(raw.body ?? "").trim();
  const category =
    String(raw.category ?? "").trim() || metadata?.defaultCategory || "general";
  const sourceUrl = String(raw.url ?? "").trim();
  const excerptRaw = raw.excerpt == null ? null : String(raw.excerpt).trim();
  const excerpt = excerptRaw ? decodeHtmlEntities(excerptRaw) : null;
  const publishedAt = toIsoOrNull(raw.publishedAt);
  const scrapedAt = toIsoOrNull(raw.scrapedAt) ?? new Date().toISOString();
  const success = raw.success === true;
  const errorText = raw.error == null ? null : String(raw.error).trim();

  return {
    sourceKey,
    sourceName: metadata?.sourceName ?? sourceKey,
    sourceUrl,
    title,
    excerpt,
    body,
    category,
    publishedAt,
    scrapedAt,
    rawPayload: raw,
    success,
    error: errorText || null,
  };
}
