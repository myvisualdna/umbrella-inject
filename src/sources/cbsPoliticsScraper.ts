import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface CBSPoliticsArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface CBSPoliticsArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes CBS News Politics section (https://www.cbsnews.com/politics/)
 * and returns the latest article items.
 * 
 * HTML Structure identified:
 * - Articles are in links with class "item__anchor"
 * - Headlines are in "h4.item__hed" inside those links
 * - Descriptions are in "p.item__dek"
 */
export async function scrapeCBSPoliticsNews(
  limit = 5
): Promise<CBSPoliticsArticleItem[]> {
  const cbsPoliticsUrl = "https://www.cbsnews.com/politics/";

  const response = await axios.get(cbsPoliticsUrl);
  const $ = cheerio.load(response.data);

  const items: CBSPoliticsArticleItem[] = [];
  const seenUrls = new Set<string>();

  // CBS News Politics page structure - articles are in links with class item__anchor
  // Headlines are in h4.item__hed inside those links
  $('a.item__anchor').each((_, link) => {
    if (items.length >= limit) return; // Stop when we've collected enough articles

    const $link = $(link);
    const rawHref = $link.attr("href");

    if (!rawHref || rawHref.includes("#") || rawHref.includes("javascript:")) {
      return; // skip invalid hrefs
    }

    // Build absolute URL
    let url: string;
    try {
      url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, cbsPoliticsUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }

    // Extract title from h4.item__hed inside the link
    const $headline = $link.find("h4.item__hed").first();
    let title = $headline.text().trim();

    // Fallback: try link text or aria-label
    if (!title || title.length < 10) {
      title = $link.text().trim() || $link.attr("aria-label") || "";
    }

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container or nearby
    const $parent = $link.closest("div.item, li, article");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || undefined;

    items.push({ title, url, imageUrl });
  });


  return items;
}

/**
 * Scrapes a CBS News article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body text
 */
export async function scrapeCBSPoliticsArticleDetails(
  articleUrl: string
): Promise<CBSPoliticsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);

  // 1) Get title from h1 first (most reliable, matches what users see)
  let title: string | null = null;
  const h1Text = $("h1.content__title, h1").first().text().trim();
  if (h1Text) {
    title = h1Text;
  }

  // 2) Try to parse JSON-LD NewsArticle block for excerpt, description, category
  let excerpt: string | null = null;
  let category: string | null = null;

  const ldJsonRaw = $('script[type="application/ld+json"]').first().html();
  if (ldJsonRaw) {
    try {
      const parsed = JSON.parse(ldJsonRaw);

      // If it's an array, find the NewsArticle object; if not, treat as object
      const articleNode = Array.isArray(parsed)
        ? parsed.find((node) => node["@type"] === "NewsArticle") ?? parsed[0]
        : parsed;

      if (articleNode && typeof articleNode === "object") {
        // Only use JSON-LD headline if we didn't get one from h1
        if (!title) {
          title = (articleNode as any).headline ?? null;
        }
        excerpt = (articleNode as any).description ?? null;
        category =
          (articleNode as any).articleSection ??
          (articleNode as any).section ??
          null;
      }
    } catch (err) {
      logger.warn("Failed to parse JSON-LD for article", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!title) {
    throw new Error("Could not determine article title");
  }

  // 3) Fallback for excerpt: use first paragraph or meta description
  if (!excerpt) {
    const metaDesc = $('meta[name="description"], meta[property="og:description"]').attr("content");
    if (metaDesc) {
      excerpt = metaDesc.trim();
    }
  }

  if (!excerpt) {
    // Try to get excerpt from the article body's first paragraph
    const firstP = $(".content__body p, .article-body p, article p").first().text().trim();
    if (firstP) {
      excerpt = firstP;
    }
  }

  if (!excerpt) {
    excerpt = ""; // we keep it non-null for typing
  }

  // Try to extract category from breadcrumbs or URL if not found in JSON-LD
  if (!category) {
    // Try breadcrumbs
    const breadcrumbText = $(".breadcrumb a, nav[aria-label='Breadcrumb'] a").last().text().trim();
    if (breadcrumbText) {
      category = breadcrumbText;
    }

    // Fallback: try to extract from URL path
    if (!category) {
      const urlMatch = articleUrl.match(/cbsnews\.com\/([^\/]+)/);
      if (urlMatch && urlMatch[1] && urlMatch[1] !== "politics") {
        category = urlMatch[1].replace(/-/g, " ");
      }
    }
  }

  // 4) Extract body paragraphs - CBS News uses .content__body or .article-body
  let bodyParagraphs: string[] = [];

  // CBS News article body is in .content__body
  const articleBodyContainer = $(".content__body, .article-body, article").first();

  if (articleBodyContainer.length) {
    bodyParagraphs = articleBodyContainer
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
  }

  // Fallback: get all paragraphs from main content area
  if (bodyParagraphs.length === 0) {
    bodyParagraphs = $("main p, .content p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
  }

  const body = bodyParagraphs.join("\n\n");

  return {
    url: articleUrl,
    title,
    excerpt,
    category,
    body,
  };
}



