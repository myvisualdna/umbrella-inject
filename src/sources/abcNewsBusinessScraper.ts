import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface ABCNewsBusinessArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface ABCNewsBusinessArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes ABC News Business section (https://abcnews.go.com/Business)
 * and returns the first 5 articles from the left column listing.
 */
export async function scrapeABCNewsBusinessHomepage(
  limit = 5
): Promise<ABCNewsBusinessArticleItem[]> {
  const abcNewsBusinessUrl = "https://abcnews.go.com/Business";

  const response = await axios.get(abcNewsBusinessUrl);
  const html = response.data;
  const $ = cheerio.load(html);

  const items: ABCNewsBusinessArticleItem[] = [];
  const seenUrls = new Set<string>();

  // ABC News embeds JSON data in the HTML
  // Extract story items directly from the embedded JSON using regex
  // The JSON structure is: "title":"...","description":"...","type":"story","location":"...","image":"..."
  // Pattern 1: Match the full JSON object structure
  const storyPattern1 = /"title":"([^"]+)","description":"[^"]*","type":"story","location":"(https:\/\/abcnews\.go\.com\/Business\/[^"]+)"[^}]*"image":"([^"]+)"/g;
  let match;
  
  while ((match = storyPattern1.exec(html)) !== null && items.length < limit) {
    let title = match[1] || "";
    const url = match[2];
    const imageUrl = match[3] || undefined;
    
    // Clean up title - decode HTML entities and escaped quotes
    title = title
      .replace(/\\"/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .trim();
    
    // Accept URLs with /Business/.../story or /Business/.../story?id=
    if (url && url.includes("abcnews.go.com/Business/") && (url.includes("/story") || url.includes("story?id=")) && !seenUrls.has(url) && title && title.length > 10) {
      seenUrls.add(url);
      items.push({ title, url, imageUrl });
    }
  }
  
  // Pattern 2: More flexible - match any order of title, type, location
  if (items.length < limit) {
    const storyPattern2 = /"title":"([^"]+)"[^}]*"type":"story"[^}]*"location":"(https:\/\/abcnews\.go\.com\/Business\/[^"]*\/story[^"]*)"/g;
    let match2;
    
    while ((match2 = storyPattern2.exec(html)) !== null && items.length < limit) {
      let title = match2[1] || "";
      const url = match2[2];
      
      title = title
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim();
      
      if (url && !seenUrls.has(url) && title && title.length > 10) {
        seenUrls.add(url);
        
        // Try to find image URL near this match
        const imageMatch = html.substring(match2.index, match2.index + 800).match(/"image":"([^"]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : undefined;
        
        items.push({ title, url, imageUrl });
      }
    }
  }
  
  // Pattern 3: Even more flexible - just find story type with location
  if (items.length < limit) {
    const storyPattern3 = /"type":"story"[^}]*"location":"(https:\/\/abcnews\.go\.com\/Business\/[^"]*\/story[^"]*)"[^}]*"title":"([^"]+)"/g;
    let match3;
    
    while ((match3 = storyPattern3.exec(html)) !== null && items.length < limit) {
      const url = match3[1];
      let title = match3[2] || "";
      
      title = title
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim();
      
      if (url && !seenUrls.has(url) && title && title.length > 10) {
        seenUrls.add(url);
        
        // Try to find image URL near this match
        const imageMatch = html.substring(match3.index, match3.index + 800).match(/"image":"([^"]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : undefined;
        
        items.push({ title, url, imageUrl });
      }
    }
  }
  
  // Pattern 4: Look for Business story URLs in any JSON structure (handles /story?id= format)
  if (items.length < limit) {
    // Match location with Business URLs that contain "story" (handles both /story/ and /story?id=)
    const storyPattern4 = /"location":"(https:\/\/abcnews\.go\.com\/Business\/[^"]*story[^"]*)"[^}]*"title":"([^"]+)"/g;
    let match4;
    
    while ((match4 = storyPattern4.exec(html)) !== null && items.length < limit) {
      const url = match4[1];
      let title = match4[2] || "";
      
      title = title
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Accept URLs with story (handles /story?id= format)
      if (url && url.includes("abcnews.go.com/Business/") && url.includes("story") && !seenUrls.has(url) && title && title.length > 10) {
        seenUrls.add(url);
        
        // Try to find image URL near this match
        const imageMatch = html.substring(match4.index, match4.index + 800).match(/"image":"([^"]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : undefined;
        
        items.push({ title, url, imageUrl });
      }
    }
  }
  
  // Fallback: Parse HTML directly for article links
  if (items.length < limit) {
    // Try multiple selectors for article links
    const linkSelectors = [
      'a[href*="/Business/story"]',
      'a[href*="/business/story"]',
      'a[href*="/Business/"]',
      'article a[href*="/Business/"]',
      '[data-testid*="story"] a',
      '[class*="story"] a[href*="/Business/"]',
      'h2 a[href*="/Business/"]',
      'h3 a[href*="/Business/"]',
    ];

    for (const linkSelector of linkSelectors) {
      if (items.length >= limit) break;

      $(linkSelector).each((_, link) => {
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
            : new URL(rawHref, abcNewsBusinessUrl).toString();
        } catch {
          return;
        }

        // Only accept abcnews.go.com/Business/ URLs that contain "story" (handles both /story/ and /story?id= formats)
        // Also accept wireStory URLs which are valid Business articles
        if (!url.includes("abcnews.go.com/Business/") || (!url.includes("story") && !url.includes("wireStory"))) {
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
          const $parent = $link.closest("article, .card, .story-card, [class*='card'], [class*='story'], div, li");
          const $titleEl = $parent.find("h1, h2, h3, h4, [class*='title'], [class*='headline'], [data-testid*='headline']").first();
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
        const $parent = $link.closest("article, .card, .story-card, [class*='card'], [class*='story'], div, li");
        const $img = $parent.find("img").first();
        const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

        items.push({ title, url, imageUrl });
      });
    }
  }

  return items.slice(0, limit);
}

/**
 * Scrapes an ABC News Business article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body text
 */
export async function scrapeABCNewsBusinessArticleDetails(
  articleUrl: string
): Promise<ABCNewsBusinessArticleDetails> {
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
        category = "Business";
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

