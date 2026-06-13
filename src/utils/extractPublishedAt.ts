import * as cheerio from "cheerio";

type CheerioRoot = ReturnType<typeof cheerio.load>;

export interface PublishedAtResult {
  value: string | null;
  source: string | null;
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function collectJsonLdNodes(parsed: unknown): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];

  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    const obj = value as Record<string, unknown>;
    if (obj["@graph"]) walk(obj["@graph"]);

    const type = obj["@type"];
    const types = Array.isArray(type) ? type : type ? [type] : [];
    if (
      types.some(
        (t) =>
          t === "NewsArticle" ||
          t === "Article" ||
          t === "BlogPosting" ||
          t === "WebPage"
      )
    ) {
      nodes.push(obj);
    }
  };

  walk(parsed);
  return nodes;
}

function extractFromJsonLd($: CheerioRoot): string | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nodes = collectJsonLdNodes(parsed);
      for (const node of nodes) {
        const datePublished = node.datePublished ?? node.dateCreated;
        if (typeof datePublished === "string") {
          const normalized = normalizeDate(datePublished);
          if (normalized) return normalized;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function extractPublishedAt(
  $: CheerioRoot,
  options?: { fallbackSelector?: string }
): PublishedAtResult {
  const fromJsonLd = extractFromJsonLd($);
  if (fromJsonLd) return { value: fromJsonLd, source: "json-ld" };

  const ogPublished = $('meta[property="article:published_time"]').attr("content");
  if (ogPublished) {
    const normalized = normalizeDate(ogPublished);
    if (normalized) return { value: normalized, source: "article:published_time" };
  }

  const pubdate = $('meta[name="pubdate"]').attr("content");
  if (pubdate) {
    const normalized = normalizeDate(pubdate);
    if (normalized) return { value: normalized, source: "pubdate" };
  }

  const dateMeta = $('meta[name="date"]').attr("content");
  if (dateMeta) {
    const normalized = normalizeDate(dateMeta);
    if (normalized) return { value: normalized, source: "date" };
  }

  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) {
    const normalized = normalizeDate(timeEl);
    if (normalized) return { value: normalized, source: "time[datetime]" };
  }

  if (options?.fallbackSelector) {
    const fallbackText = $(options.fallbackSelector).first().text().trim();
    if (fallbackText) {
      const normalized = normalizeDate(fallbackText);
      if (normalized) return { value: normalized, source: options.fallbackSelector };
    }
  }

  return { value: null, source: null };
}
