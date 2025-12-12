import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface TechCrunchArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface TechCrunchArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes TechCrunch homepage (https://techcrunch.com/)
 * and returns the latest top headline articles from the "Top Headlines" section.
 * 
 * HTML Structure identified:
 * - "Top Headlines" section is identified by .hero-package-2__heading containing "Top Headlines"
 * - Articles are in .loop-card containers within the Top Headlines section
 * - Article links are in .loop-card__title-link
 * - Article URLs follow pattern: /YYYY/MM/DD/article-title/
 */
export async function scrapeTechCrunchNews(
  limit = 5
): Promise<TechCrunchArticleItem[]> {
  const techCrunchUrl = "https://techcrunch.com/";

  const response = await axios.get(techCrunchUrl);
  const $ = cheerio.load(response.data);

  const items: TechCrunchArticleItem[] = [];
  const seenUrls = new Set<string>();

  // TechCrunch homepage structure - "Top Headlines" section
  // The "Top Headlines" section contains articles in loop-card containers
  // Article links are in .loop-card__title-link within the Top Headlines section
  
  // Find the "Top Headlines" section
  // It's identified by .hero-package-2__heading containing "Top Headlines"
  let $topHeadlinesSection = $('.hero-package-2__heading')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('top headlines');
    })
    .closest('.hero-package-2, .wp-block-group, section, div')
    .first();

  if ($topHeadlinesSection.length === 0) {
    logger.warn("Could not find 'Top Headlines' section, trying alternative approach");
    // Fallback: look for any section containing "Top Headlines" text
    $('p, h2, h3').each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes('top headlines')) {
        const $section = $(el).closest('.hero-package-2, .wp-block-group, section, div').first();
        if ($section.length && $topHeadlinesSection.length === 0) {
          $topHeadlinesSection = $section;
          return false; // break
        }
      }
    });
  }

  // If we found the Top Headlines section, scrape articles from it
  if ($topHeadlinesSection.length > 0) {
    logger.info("Found 'Top Headlines' section, scraping articles...");
    
    // Find all article links in the Top Headlines section
    $topHeadlinesSection.find('.loop-card__title-link, a.loop-card__title-link').each((_, link) => {
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
          : new URL(rawHref, techCrunchUrl).toString();
      } catch {
        return; // skip invalid URLs
      }

      // Only accept techcrunch.com URLs
      if (!url.includes("techcrunch.com/")) {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }

      // Only accept article URLs (pattern: /YYYY/MM/DD/article-title/)
      // Skip section/category pages, homepage, feeds, etc.
      const isArticleUrl = url.match(/\/\d{4}\/\d{2}\/\d{2}\/[^\/]+/);
      const isVideoUrl = url.match(/\/video\//);
      
      // Skip if not an article or video URL, or if it matches exclusion patterns
      if (
        (!isArticleUrl && !isVideoUrl) ||
        url.match(/\/tag\//) ||
        url.match(/\/author\//) ||
        url.match(/\/category\//) ||
        url.match(/\/events\//) ||
        url.match(/\/feed\//) ||
        url.match(/\/page\//) ||
        url.match(/\/wp-/) ||
        url === techCrunchUrl ||
        url === `${techCrunchUrl}/`
      ) {
        return;
      }

      // Extract title from link text
      let title = $link.text().trim();
      
      // If title is empty, try parent h3 or loop-card__title
      if (!title || title.length < 10) {
        const $parent = $link.closest("h3, .loop-card__title");
        if ($parent.length) {
          title = $parent.text().trim();
        }
      }

      // Fallback: try aria-label
      if (!title || title.length < 10) {
        title = $link.attr("aria-label") || "";
      }

      // Skip if no title found or title is too short
      if (!title || title.length < 10) {
        return;
      }

      seenUrls.add(url);

      // Find image - look in the loop-card container
      const $loopCard = $link.closest(".loop-card");
      const $img = $loopCard.find("img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

      items.push({ title, url, imageUrl });
    });
  } else {
    logger.warn("Could not locate 'Top Headlines' section, falling back to general article search");
  }

  return items;
}

/**
 * Scrapes a TechCrunch article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body text
 */
export async function scrapeTechCrunchArticleDetails(
  articleUrl: string
): Promise<TechCrunchArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);

  // 1) Get title from h1 first (most reliable, matches what users see)
  let title: string | null = null;
  const h1Text = $("h1.article__title, h1").first().text().trim();
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
    const firstP = $(".article-content p, .article__content p, article p").first().text().trim();
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
      const urlMatch = articleUrl.match(/techcrunch\.com\/([^\/]+)/);
      if (urlMatch && urlMatch[1] && !urlMatch[1].match(/^\d{4}\/\d{2}\/\d{2}/)) {
        category = urlMatch[1].replace(/-/g, " ");
      }
    }
  }

  // 4) Extract body paragraphs - TechCrunch uses .article-content or .article__content
  let bodyParagraphs: string[] = [];

  // TechCrunch article body is in .article-content or .article__content
  const articleBodyContainer = $(".article-content, .article__content, article").first();

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

