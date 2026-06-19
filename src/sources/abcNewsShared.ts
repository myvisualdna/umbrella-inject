import * as cheerio from "cheerio";
import { logger } from "../config/logger";
import { cleanArticleBody } from "../scraping/cleanArticleBody";
import { extractPublishedAt } from "../utils/extractPublishedAt";

type CheerioRoot = ReturnType<typeof cheerio.load>;

export type ABCSectionSegment = "US" | "International" | "Business" | "Technology";

export interface ABCNewsArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface ABCNewsArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
  publishedAt: string | null;
}

const REJECT_URL_PATTERNS = [
  /tip-share/i,
  /Press_Release/i,
  /apps\.apple\.com/i,
  /play\.google\.com/i,
  /\/video\//i,
];

export function normalizeAbcUrl(url: string): string {
  return url.replace("abcnews.go.com", "abcnews.com");
}

export function isAbcStoryUrl(url: string, section: ABCSectionSegment): boolean {
  const normalized = normalizeAbcUrl(url);
  if (!normalized.includes("abcnews.com")) return false;
  if (REJECT_URL_PATTERNS.some((re) => re.test(normalized))) return false;

  const sectionPath = `/${section}/`;
  if (!normalized.includes(sectionPath)) return false;

  return /\/story\?id=\d+/.test(normalized) || /\/wireStory\//.test(normalized);
}

function decodeAbcTitle(title: string): string {
  return title
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .trim();
}

export function discoverABCNewsStories(
  $: CheerioRoot,
  baseUrl: string,
  section: ABCSectionSegment,
  limit: number
): ABCNewsArticleItem[] {
  const items: ABCNewsArticleItem[] = [];
  const seenUrls = new Set<string>();

  $(`a[href*="/${section}/"], a[href*="story?id="]`).each((_, link) => {
    if (items.length >= limit) return;

    const $link = $(link);
    const rawHref = $link.attr("href");
    if (!rawHref || rawHref.includes("#") || rawHref.includes("javascript:")) {
      return;
    }

    let url: string;
    try {
      url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, baseUrl).toString();
    } catch {
      return;
    }

    url = normalizeAbcUrl(url);
    if (!isAbcStoryUrl(url, section) || seenUrls.has(url)) return;

    let title = $link.text().trim();
    if (!title || title.length < 10) {
      const $parent = $link.closest(
        "article, .card, .story-card, [class*='card'], [class*='story'], div"
      );
      const $titleEl = $parent
        .find("h2, h3, h4, [class*='title'], [class*='headline']")
        .first();
      if ($titleEl.length) {
        title = $titleEl.text().trim();
      }
    }

    if (!title || title.length < 10) {
      title = $link.attr("aria-label") || $link.attr("title") || "";
    }

    title = decodeAbcTitle(title);
    if (!title || title.length < 10) return;

    seenUrls.add(url);

    const $parent = $link.closest(
      "article, .card, .story-card, [class*='card'], [class*='story'], div"
    );
    const $img = $parent.find("img").first();
    const imageUrl =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      undefined;

    items.push({ title, url, imageUrl });
  });

  return items.slice(0, limit);
}

export function extractABCNewsArticleDetailsFromPage(
  $: CheerioRoot,
  articleUrl: string,
  defaultCategory: string
): ABCNewsArticleDetails {
  let title: string | null = null;
  const h1Text = $("h1[data-testid='Heading'], h1.article-title, h1")
    .first()
    .text()
    .trim();
  if (h1Text) {
    title = h1Text;
  }

  let excerpt: string | null = null;
  let category: string | null = null;

  const ldJsonRaw = $('script[type="application/ld+json"]').first().html();
  if (ldJsonRaw) {
    try {
      const parsed = JSON.parse(ldJsonRaw);
      const articleNode = Array.isArray(parsed)
        ? parsed.find((node) => node["@type"] === "NewsArticle") ?? parsed[0]
        : parsed;

      if (articleNode && typeof articleNode === "object") {
        if (!title) {
          title = (articleNode as { headline?: string }).headline ?? null;
        }
        excerpt = (articleNode as { description?: string }).description ?? null;
        category =
          (articleNode as { articleSection?: string; section?: string })
            .articleSection ??
          (articleNode as { section?: string }).section ??
          null;
      }
    } catch (err) {
      logger.warn("Failed to parse JSON-LD for ABC article", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!title) {
    throw new Error("Could not determine article title");
  }

  if (!excerpt) {
    const metaDesc = $('meta[name="description"], meta[property="og:description"]').attr(
      "content"
    );
    if (metaDesc) excerpt = metaDesc.trim();
  }

  if (!excerpt) {
    const firstP = $(".article-body p, .article-content p, article p, [class*='article'] p")
      .first()
      .text()
      .trim();
    if (firstP) excerpt = firstP;
  }

  if (!excerpt) excerpt = "";

  if (!category) {
    const breadcrumbText = $(
      ".breadcrumb a, nav[aria-label='Breadcrumb'] a, [class*='breadcrumb'] a"
    )
      .last()
      .text()
      .trim();
    if (breadcrumbText) category = breadcrumbText;
  }

  if (!category) {
    const urlMatch = articleUrl.match(/abcnews\.(?:go\.)?com\/([^/]+)/);
    category = urlMatch?.[1]?.replace(/-/g, " ") ?? defaultCategory;
  }

  let bodyParagraphs: string[] = [];
  const articleBodyContainer = $(
    ".article-body, .article-content, article, [class*='article-body'], [class*='article-content']"
  ).first();

  if (articleBodyContainer.length) {
    bodyParagraphs = articleBodyContainer
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 20);
  }

  if (bodyParagraphs.length === 0) {
    bodyParagraphs = $("main p, .content p, [data-testid='ArticleBody'] p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 20);
  }

  const rawBody = bodyParagraphs.join("\n\n");
  const body = cleanArticleBody(rawBody) ?? "";

  const { value: publishedAt } = extractPublishedAt($);

  return {
    url: normalizeAbcUrl(articleUrl),
    title,
    excerpt,
    category,
    body,
    publishedAt,
  };
}
