import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface ABCNewsTechnologyArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface ABCNewsTechnologyArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes ABC News Technology section (https://abcnews.go.com/Technology)
 * and returns the first 5 articles from the "Latest Technology Headlines" section.
 */
export async function scrapeABCNewsTechnologyHomepage(
  limit = 5
): Promise<ABCNewsTechnologyArticleItem[]> {
  const abcNewsTechnologyUrl = "https://abcnews.go.com/Technology";

  logger.info("Fetching ABC News Technology page...", { url: abcNewsTechnologyUrl });
  const response = await axios.get(abcNewsTechnologyUrl);
  const html = response.data;
  const $ = cheerio.load(html);

  const items: ABCNewsTechnologyArticleItem[] = [];
  const seenUrls = new Set<string>();

  // ABC News embeds JSON data in the HTML
  // Extract story items directly from the embedded JSON using regex
  // The JSON structure can vary: "title":"...","location":"..." or "location":"...","title":"..."
  // We'll look for both stories and wirestories (both are articles)
  
  // Pattern 1: Match title first, then location (flexible order)
  const storyPattern1 = /"title":"([^"]+)"[^}]{0,500}?"location":"(https:\/\/abcnews\.go\.com\/Technology\/(story|wireStory)\/[^"]+)"/g;
  let match;
  
  while ((match = storyPattern1.exec(html)) !== null && items.length < limit) {
    let title = match[1] || "";
    const url = match[2];
    
    // Clean up title - decode HTML entities and escaped quotes
    title = title
      .replace(/\\"/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .trim();
    
    if (url && (url.includes("/Technology/story") || url.includes("/Technology/wireStory")) && !seenUrls.has(url) && title && title.length > 10) {
      seenUrls.add(url);
      
      // Try to find image URL near this match
      const imageMatch = html.substring(match.index, match.index + 1000).match(/"image":"([^"]+)"/);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;
      
      items.push({ title, url, imageUrl });
    }
  }
  
  // Pattern 2: Match location first, then title (reverse order)
  if (items.length < limit) {
    const storyPattern2 = /"location":"(https:\/\/abcnews\.go\.com\/Technology\/(story|wireStory)\/[^"]+)"[^}]{0,500}?"title":"([^"]+)"/g;
    let match2;
    
    while ((match2 = storyPattern2.exec(html)) !== null && items.length < limit) {
      const url = match2[1];
      let title = match2[3] || "";
      
      title = title
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .trim();
      
      if (url && !seenUrls.has(url) && title && title.length > 10) {
        seenUrls.add(url);
        
        // Try to find image URL near this match
        const imageMatch = html.substring(match2.index, match2.index + 1000).match(/"image":"([^"]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : undefined;
        
        items.push({ title, url, imageUrl });
      }
    }
  }
  
  // Fallback: Parse HTML directly for article links
  if (items.length < limit) {
    $('a[href*="/Technology/story"], a[href*="/Technology/wireStory"]').each((_, link) => {
      if (items.length >= limit) return;

      const $link = $(link);
      const rawHref = $link.attr("href");

      if (!rawHref || rawHref.includes("#") || rawHref.includes("javascript:")) {
        return;
      }

      // Build absolute URL
      let url: string;
      try {
        url = rawHref.startsWith("http")
          ? rawHref
          : new URL(rawHref, abcNewsTechnologyUrl).toString();
      } catch {
        return;
      }

      // Accept abcnews.go.com/Technology/story or wireStory URLs
      if (!url.includes("abcnews.go.com/Technology/story") && !url.includes("abcnews.go.com/Technology/wireStory")) {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }

      // Extract title
      let title = $link.text().trim();

      // Try to find title in parent container
      if (!title || title.length < 10) {
        const $parent = $link.closest("article, .card, .story-card, [class*='card'], [class*='story'], div");
        const $titleEl = $parent.find("h2, h3, h4, [class*='title'], [class*='headline']").first();
        if ($titleEl.length) {
          title = $titleEl.text().trim();
        }
      }

      // Fallback: try aria-label or data attributes
      if (!title || title.length < 10) {
        title = $link.attr("aria-label") || $link.attr("title") || "";
      }

      // Skip if no title found or title is too short
      if (!title || title.length < 10) {
        return;
      }

      seenUrls.add(url);

      // Find image - look in parent container
      const $parent = $link.closest("article, .card, .story-card, [class*='card'], [class*='story'], div");
      const $img = $parent.find("img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || undefined;

      items.push({ title, url, imageUrl });
    });
  }

  logger.info("Scraped ABC News Technology items", {
    count: items.length,
    limit: limit,
  });

  return items.slice(0, limit);
}

/**
 * Scrapes an ABC News Technology article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body text
 */
export async function scrapeABCNewsTechnologyArticleDetails(
  articleUrl: string
): Promise<ABCNewsTechnologyArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);

  // 1) Get title from h1 first (most reliable, matches what users see)
  let title: string | null = null;
  const h1Text = $("h1[data-testid='Heading'], h1.article-title, h1").first().text().trim();
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
    const firstP = $(".article-body p, .article-content p, article p, [class*='article'] p").first().text().trim();
    if (firstP) {
      excerpt = firstP;
    }
  }

  if (!excerpt) {
    excerpt = "";
  }

  // Try to extract category from breadcrumbs or URL if not found in JSON-LD
  if (!category) {
    // Try breadcrumbs
    const breadcrumbText = $(".breadcrumb a, nav[aria-label='Breadcrumb'] a, [class*='breadcrumb'] a").last().text().trim();
    if (breadcrumbText) {
      category = breadcrumbText;
    }

    // Fallback: try to extract from URL path
    if (!category) {
      const urlMatch = articleUrl.match(/abcnews\.go\.com\/([^\/]+)/);
      if (urlMatch && urlMatch[1]) {
        category = urlMatch[1].replace(/-/g, " ");
      } else {
        category = "Technology";
      }
    }
  }

  // 4) Extract body paragraphs - ABC News uses various selectors
  let bodyParagraphs: string[] = [];

  // Try common ABC News article body selectors
  const articleBodyContainer = $(".article-body, .article-content, article, [class*='article-body'], [class*='article-content']").first();

  if (articleBodyContainer.length) {
    bodyParagraphs = articleBodyContainer
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 20); // Filter out very short paragraphs (likely metadata)
  }

  // Fallback: get all paragraphs from main content area
  if (bodyParagraphs.length === 0) {
    bodyParagraphs = $("main p, .content p, [data-testid='ArticleBody'] p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 20);
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

