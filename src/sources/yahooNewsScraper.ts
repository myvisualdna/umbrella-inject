import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface YahooUSArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface YahooArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes Yahoo News US section (https://www.yahoo.com/news/us/)
 * and returns the latest article items.
 */
export async function scrapeYahooUSNews(
  limit = 4
): Promise<YahooUSArticleItem[]> {
  const usNewsUrl = "https://www.yahoo.com/news/us/";

  const response = await axios.get(usNewsUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
    "watch now",
    "trending",
  ];

  // Yahoo News US page structure - focus on article containers
  const selectors = [
    'article a[href*="/news/articles/"]',
    'article a[href*="/news/us/"]',
    '[data-module="Article"] a[href*="/news/articles/"]',
    '.caas-list-item a[href*="/news/articles/"]',
    'a[href*="/news/articles/"]',
  ];

  for (const selector of selectors) {
    if (items.length >= limit) break; // Stop when we've collected enough articles

    $(selector).each((_, link) => {
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
          : new URL(rawHref, usNewsUrl).toString();
      } catch {
        return; // skip invalid URLs
      }

      // Only accept yahoo.com/news/articles/ URLs (actual articles)
      // Exclude finance.yahoo.com, section pages, and other non-article URLs
      if (!url.includes("yahoo.com/news/articles/")) {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }

      // Extract title from link text or nearby elements
      let title = $link.text().trim();

      // If title is empty or too short, try to find it in parent/child elements
      if (!title || title.length < 10) {
        const $parent = $link.closest("article, li, div");
        const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .js-stream-content h3").first();
        title = $titleEl.text().trim();
      }

      // Skip if no title found or title is too short
      if (!title || title.length < 10) {
        return;
      }

      // Skip navigation/section links by checking title text
      const titleLower = title.toLowerCase();
      if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
        return;
      }

      // Skip URLs that are section pages (not individual articles)
      if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment)\/?$/)) {
        return;
      }

      seenUrls.add(url);

      // Find image - look in parent container
      const $parent = $link.closest("article, li, div");
      const $img = $parent.find("img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || undefined;

      items.push({ title, url, imageUrl });
    });
  }

  return items.slice(0, limit);
}

/**
 * Scrapes Yahoo News World section (https://www.yahoo.com/news/world/)
 * and returns the latest article items.
 */
export async function scrapeYahooWorldNews(
  limit = 4
): Promise<YahooUSArticleItem[]> {
  const worldNewsUrl = "https://www.yahoo.com/news/world/";

  const response = await axios.get(worldNewsUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
  ];

  // Yahoo News World page structure - focus on article containers
  const selectors = [
    'article a[href*="/news/articles/"]',
    'article a[href*="/news/world/"]',
    '[data-module="Article"] a[href*="/news/articles/"]',
    '.caas-list-item a[href*="/news/articles/"]',
    'a[href*="/news/articles/"]',
  ];

  for (const selector of selectors) {
    if (items.length >= limit) break; // Stop when we've collected enough articles

    $(selector).each((_, link) => {
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
          : new URL(rawHref, worldNewsUrl).toString();
      } catch {
        return; // skip invalid URLs
      }

      // Only accept yahoo.com/news/articles/ URLs (actual articles)
      // Exclude finance.yahoo.com, section pages, and other non-article URLs
      if (!url.includes("yahoo.com/news/articles/")) {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }

      // Extract title from link text or nearby elements
      let title = $link.text().trim();

      // If title is empty or too short, try to find it in parent/child elements
      if (!title || title.length < 10) {
        const $parent = $link.closest("article, li, div");
        const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .js-stream-content h3").first();
        title = $titleEl.text().trim();
      }

      // Skip if no title found or title is too short
      if (!title || title.length < 10) {
        return;
      }

      // Skip navigation/section links by checking title text
      const titleLower = title.toLowerCase();
      if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
        return;
      }

      // Skip URLs that are section pages (not individual articles)
      if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment)\/?$/)) {
        return;
      }

      seenUrls.add(url);

      // Find image - look in parent container
      const $parent = $link.closest("article, li, div");
      const $img = $parent.find("img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || undefined;

      items.push({ title, url, imageUrl });
    });
  }

  return items;
}

/**
 * Scrapes Yahoo News Politics section (https://www.yahoo.com/news/politics/)
 * and returns the latest article items.
 */
export async function scrapeYahooPoliticsNews(
  limit = 7
): Promise<YahooUSArticleItem[]> {
  const politicsNewsUrl = "https://www.yahoo.com/news/politics/";

  const response = await axios.get(politicsNewsUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
  ];

  // Yahoo News Politics page structure - find all article links in DOM order
  // Collect all valid article links first, then filter and take the first 7
  const allArticleLinks: Array<{ url: string; title: string; imageUrl?: string; domIndex: number }> = [];
  let domIndex = 0;

  // Find all article links on the page (in DOM order)
  $('a[href*="/news/articles/"]').each((_, link) => {
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
        : new URL(rawHref, politicsNewsUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Only accept yahoo.com/news/articles/ URLs (actual articles)
    if (!url.includes("yahoo.com/news/articles/")) {
      return;
    }

    // Skip if already seen
    if (seenUrls.has(url)) {
      return;
    }

    // Skip section pages
    if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment)\/?$/)) {
      return;
    }

    // Skip if in sidebar/navigation areas
    const $closestContainer = $link.closest("aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer");
    if ($closestContainer.length > 0) {
      return;
    }

    // Extract title from link text or nearby elements
    let title = $link.text().trim();

    // If title is empty or too short, try to find it in parent/child elements
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3").first();
      if ($titleEl.length === 0) {
        // Try parent's text if it's a heading
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    // Clean title: remove source/category prefixes
    // Common patterns: "PoliticsAssociated PressPolitical consultant...", "USThe Guardian'Living an American nightmare'..."
    // The pattern is usually: Category + Source + Title (often concatenated without spaces)
    
    const categoryPrefixes = ["politics", "us", "world", "business", "technology", "entertainment", "sports", "health", "science"];
    const sourceNames = [
      "associated press", "ap", "reuters", "the guardian", "cbs news", "cnn", "nbc news", 
      "abc news", "fox news", "the hill", "politico", "bloomberg", "the washington post",
      "the new york times", "usa today", "time", "newsweek", "the atlantic", "axios", "bbc"
    ];
    
    let cleanedTitle = title;
    
    // Strategy: Find where the actual title starts by looking for patterns
    // Titles typically start with a capital letter followed by lowercase letters
    
    // First, try to match and remove category + source pattern
    // Pattern: Category (lowercase) + Source (capitalized, possibly concatenated) + Title (capitalized)
    for (const category of categoryPrefixes) {
      for (const source of sourceNames) {
        // Pattern 1: "PoliticsAssociated PressTitle" (category lowercase, source capitalized, title capitalized)
        const pattern1 = new RegExp(`^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`, "i");
        const match1 = cleanedTitle.match(pattern1);
        if (match1 && match1[1] && match1[1].length > 10) {
          cleanedTitle = match1[1].trim();
          break;
        }
        
        // Pattern 2: "USThe Guardian'Title'" (category uppercase, source capitalized)
        const pattern2 = new RegExp(`^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`, "i");
        const match2 = cleanedTitle.match(pattern2);
        if (match2 && match2[1] && match2[1].length > 10) {
          cleanedTitle = match2[1].trim();
          // Remove leading quotes if present
          cleanedTitle = cleanedTitle.replace(/^['"]+|['"]+$/g, "").trim();
          break;
        }
      }
      if (cleanedTitle !== title && cleanedTitle.length > 10) break;
    }
    
    // If still not cleaned, try removing just category prefix
    if (cleanedTitle === title) {
      for (const category of categoryPrefixes) {
        if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
          const afterCategory = cleanedTitle.substring(category.length).trim();
          // Check if what follows looks like a source name
          let foundSource = false;
          for (const source of sourceNames) {
            if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
              // Remove source too
              const afterSource = afterCategory.substring(source.length).trim();
              if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
                cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
                foundSource = true;
                break;
              }
            }
          }
          if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
            cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
          }
          break;
        }
      }
    }
    
    // Final fallback: if title still contains source patterns, try to extract just the title part
    // Look for a sequence that looks like a real title (starts with capital, has multiple words)
    if (cleanedTitle === title || cleanedTitle.length < 10) {
      // Find the longest sequence that starts with a capital letter and has multiple words
      const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
      if (titleMatch && titleMatch[1]) {
        const potentialTitle = titleMatch[1].trim();
        // Make sure it's not just a source name
        const isSource = sourceNames.some(s => potentialTitle.toLowerCase().includes(s.toLowerCase()));
        if (!isSource && potentialTitle.length > 15) {
          cleanedTitle = potentialTitle;
        }
      }
    }
    
    // Final check: if cleaned title is too short, use original
    if (cleanedTitle.length < 10) {
      cleanedTitle = title;
    }
    
    title = cleanedTitle;

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    // Skip navigation/section links by checking title text
    const titleLower = title.toLowerCase();
    if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
      return;
    }

    // Additional filtering: skip links that are clearly not main articles
    // (e.g., "read more", "see all", etc.)
    const skipPatterns = ["read more", "see all", "view all", "more stories", "trending", "popular"];
    if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container
    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

    // Store with DOM index to preserve order
    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  // Remove duplicates by URL (keep first occurrence based on DOM order)
  const uniqueArticles = new Map<string, typeof allArticleLinks[0]>();
  for (const article of allArticleLinks) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Take the first N articles (latest ones, as they appear first in DOM)
  // Sort by DOM index to ensure correct order
  const latestArticles = Array.from(uniqueArticles.values())
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit);

  // Convert to expected format
  for (const article of latestArticles) {
    items.push({ title: article.title, url: article.url, imageUrl: article.imageUrl });
  }

  return items;
}

/**
 * Scrapes Yahoo Finance section (https://finance.yahoo.com/)
 * and returns the latest article items.
 */
export async function scrapeYahooFinanceNews(
  limit = 4
): Promise<YahooUSArticleItem[]> {
  const financeUrl = "https://finance.yahoo.com/";

  const response = await axios.get(financeUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
    "watch now",
    "trending",
    "most active",
    "top gainers",
    "top losers",
  ];

  // Yahoo Finance page structure - find all article links in DOM order
  // Collect all valid article links first, then filter and take the first 4
  const allArticleLinks: Array<{ url: string; title: string; imageUrl?: string; domIndex: number }> = [];
  let domIndex = 0;

  // Find all article links on the page (in DOM order)
  // Yahoo Finance uses both finance.yahoo.com/news/ and yahoo.com/news/articles/ URLs
  $('a[href*="/news/"], a[href*="/article/"]').each((_, link) => {
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
        : new URL(rawHref, financeUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Accept both finance.yahoo.com/news/ and yahoo.com/news/articles/ URLs
    if (!url.includes("yahoo.com/news/") && !url.includes("yahoo.com/article/")) {
      return;
    }

    // Skip if already seen
    if (seenUrls.has(url)) {
      return;
    }

    // Skip section pages
    if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment|finance)\/?$/)) {
      return;
    }

    // Skip if in sidebar/navigation areas
    const $closestContainer = $link.closest("aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer");
    if ($closestContainer.length > 0) {
      return;
    }

    // Extract title from link text or nearby elements
    let title = $link.text().trim();

    // If title is empty or too short, try to find it in parent/child elements
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3").first();
      if ($titleEl.length === 0) {
        // Try parent's text if it's a heading
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    // Clean title: remove source/category prefixes
    const categoryPrefixes = ["politics", "us", "world", "business", "technology", "entertainment", "sports", "health", "science", "finance"];
    const sourceNames = [
      "associated press", "ap", "reuters", "the guardian", "cbs news", "cnn", "nbc news", 
      "abc news", "fox news", "the hill", "politico", "bloomberg", "the washington post",
      "the new york times", "usa today", "time", "newsweek", "the atlantic", "axios", "bbc",
      "yahoo finance", "yahoo personal finance"
    ];
    
    let cleanedTitle = title;
    
    // Strategy: Find where the actual title starts by looking for patterns
    for (const category of categoryPrefixes) {
      for (const source of sourceNames) {
        const pattern1 = new RegExp(`^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`, "i");
        const match1 = cleanedTitle.match(pattern1);
        if (match1 && match1[1] && match1[1].length > 10) {
          cleanedTitle = match1[1].trim();
          break;
        }
        
        const pattern2 = new RegExp(`^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`, "i");
        const match2 = cleanedTitle.match(pattern2);
        if (match2 && match2[1] && match2[1].length > 10) {
          cleanedTitle = match2[1].trim();
          cleanedTitle = cleanedTitle.replace(/^['"]+|['"]+$/g, "").trim();
          break;
        }
      }
      if (cleanedTitle !== title && cleanedTitle.length > 10) break;
    }
    
    // If still not cleaned, try removing just category prefix
    if (cleanedTitle === title) {
      for (const category of categoryPrefixes) {
        if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
          const afterCategory = cleanedTitle.substring(category.length).trim();
          let foundSource = false;
          for (const source of sourceNames) {
            if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
              const afterSource = afterCategory.substring(source.length).trim();
              if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
                cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
                foundSource = true;
                break;
              }
            }
          }
          if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
            cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
          }
          break;
        }
      }
    }
    
    // Final fallback: if title still contains source patterns, try to extract just the title part
    if (cleanedTitle === title || cleanedTitle.length < 10) {
      const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
      if (titleMatch && titleMatch[1]) {
        const potentialTitle = titleMatch[1].trim();
        const isSource = sourceNames.some(s => potentialTitle.toLowerCase().includes(s.toLowerCase()));
        if (!isSource && potentialTitle.length > 15) {
          cleanedTitle = potentialTitle;
        }
      }
    }
    
    // Final check: if cleaned title is too short, use original
    if (cleanedTitle.length < 10) {
      cleanedTitle = title;
    }
    
    title = cleanedTitle;

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    // Skip navigation/section links by checking title text
    const titleLower = title.toLowerCase();
    if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
      return;
    }

    // Additional filtering: skip links that are clearly not main articles
    const skipPatterns = ["read more", "see all", "view all", "more stories", "trending", "popular", "watch now"];
    if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container
    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

    // Store with DOM index to preserve order
    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  // Remove duplicates by URL (keep first occurrence based on DOM order)
  const uniqueArticles = new Map<string, typeof allArticleLinks[0]>();
  for (const article of allArticleLinks) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Take the first N articles (latest ones, as they appear first in DOM)
  // Sort by DOM index to ensure correct order
  const latestArticles = Array.from(uniqueArticles.values())
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit);

  // Convert to expected format
  for (const article of latestArticles) {
    items.push({ title: article.title, url: article.url, imageUrl: article.imageUrl });
  }

  return items;
}

/**
 * Scrapes Yahoo Entertainment section (https://www.yahoo.com/entertainment/)
 * and returns the latest article items.
 */
export async function scrapeYahooEntertainmentNews(
  limit = 5
): Promise<YahooUSArticleItem[]> {
  const entertainmentUrl = "https://www.yahoo.com/entertainment/";

  const response = await axios.get(entertainmentUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
    "watch now",
    "trending",
    "most active",
    "top gainers",
    "top losers",
  ];

  // Yahoo Entertainment page structure - find all article links in DOM order
  // Collect all valid article links first, then filter and take the first 5
  const allArticleLinks: Array<{ url: string; title: string; imageUrl?: string; domIndex: number }> = [];
  let domIndex = 0;

  // Find all article links on the page (in DOM order)
  $('a[href*="/news/articles/"], a[href*="/entertainment/"]').each((_, link) => {
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
        : new URL(rawHref, entertainmentUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Accept yahoo.com/news/articles/ and yahoo.com/entertainment/ URLs
    if (!url.includes("yahoo.com/news/articles/") && !url.includes("yahoo.com/entertainment/")) {
      return;
    }

    // Skip if already seen
    if (seenUrls.has(url)) {
      return;
    }

    // Skip section pages
    if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment|finance)\/?$/) || url.match(/\/entertainment\/?$/)) {
      return;
    }

    // Skip if in sidebar/navigation areas
    const $closestContainer = $link.closest("aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer");
    if ($closestContainer.length > 0) {
      return;
    }

    // Extract title from link text or nearby elements
    let title = $link.text().trim();

    // If title is empty or too short, try to find it in parent/child elements
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3").first();
      if ($titleEl.length === 0) {
        // Try parent's text if it's a heading
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    // Clean title: remove source/category prefixes
    const categoryPrefixes = ["politics", "us", "world", "business", "technology", "entertainment", "sports", "health", "science", "finance"];
    const sourceNames = [
      "associated press", "ap", "reuters", "the guardian", "cbs news", "cnn", "nbc news", 
      "abc news", "fox news", "the hill", "politico", "bloomberg", "the washington post",
      "the new york times", "usa today", "time", "newsweek", "the atlantic", "axios", "bbc",
      "yahoo finance", "yahoo personal finance", "yahoo entertainment", "yahoo movies"
    ];
    
    let cleanedTitle = title;
    
    // Strategy: Find where the actual title starts by looking for patterns
    for (const category of categoryPrefixes) {
      for (const source of sourceNames) {
        const pattern1 = new RegExp(`^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`, "i");
        const match1 = cleanedTitle.match(pattern1);
        if (match1 && match1[1] && match1[1].length > 10) {
          cleanedTitle = match1[1].trim();
          break;
        }
        
        const pattern2 = new RegExp(`^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`, "i");
        const match2 = cleanedTitle.match(pattern2);
        if (match2 && match2[1] && match2[1].length > 10) {
          cleanedTitle = match2[1].trim();
          cleanedTitle = cleanedTitle.replace(/^['"]+|['"]+$/g, "").trim();
          break;
        }
      }
      if (cleanedTitle !== title && cleanedTitle.length > 10) break;
    }
    
    // If still not cleaned, try removing just category prefix
    if (cleanedTitle === title) {
      for (const category of categoryPrefixes) {
        if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
          const afterCategory = cleanedTitle.substring(category.length).trim();
          let foundSource = false;
          for (const source of sourceNames) {
            if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
              const afterSource = afterCategory.substring(source.length).trim();
              if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
                cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
                foundSource = true;
                break;
              }
            }
          }
          if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
            cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
          }
          break;
        }
      }
    }
    
    // Final fallback: if title still contains source patterns, try to extract just the title part
    if (cleanedTitle === title || cleanedTitle.length < 10) {
      const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
      if (titleMatch && titleMatch[1]) {
        const potentialTitle = titleMatch[1].trim();
        const isSource = sourceNames.some(s => potentialTitle.toLowerCase().includes(s.toLowerCase()));
        if (!isSource && potentialTitle.length > 15) {
          cleanedTitle = potentialTitle;
        }
      }
    }
    
    // Final check: if cleaned title is too short, use original
    if (cleanedTitle.length < 10) {
      cleanedTitle = title;
    }
    
    title = cleanedTitle;

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    // Skip navigation/section links by checking title text
    const titleLower = title.toLowerCase();
    if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
      return;
    }

    // Additional filtering: skip links that are clearly not main articles
    const skipPatterns = ["read more", "see all", "view all", "more stories", "trending", "popular", "watch now"];
    if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container
    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

    // Store with DOM index to preserve order
    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  // Remove duplicates by URL (keep first occurrence based on DOM order)
  const uniqueArticles = new Map<string, typeof allArticleLinks[0]>();
  for (const article of allArticleLinks) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Take the first N articles (latest ones, as they appear first in DOM)
  // Sort by DOM index to ensure correct order
  const latestArticles = Array.from(uniqueArticles.values())
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit);

  // Convert to expected format
  for (const article of latestArticles) {
    items.push({ title: article.title, url: article.url, imageUrl: article.imageUrl });
  }

  return items;
}

/**
 * Scrapes Yahoo Lifestyle section (https://www.yahoo.com/lifestyle/)
 * and returns the latest article items.
 */
export async function scrapeYahooLifestyleNews(
  limit = 5
): Promise<YahooUSArticleItem[]> {
  const lifestyleUrl = "https://www.yahoo.com/lifestyle/";

  const response = await axios.get(lifestyleUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
    "watch now",
    "trending",
    "most active",
    "top gainers",
    "top losers",
  ];

  // Yahoo Lifestyle page structure - find all article links in DOM order
  // Collect all valid article links first, then filter and take the first 5
  const allArticleLinks: Array<{ url: string; title: string; imageUrl?: string; domIndex: number }> = [];
  let domIndex = 0;

  // Find all article links on the page (in DOM order)
  $('a[href*="/news/articles/"], a[href*="/lifestyle/"]').each((_, link) => {
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
        : new URL(rawHref, lifestyleUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Accept yahoo.com/news/articles/ and yahoo.com/lifestyle/ URLs
    if (!url.includes("yahoo.com/news/articles/") && !url.includes("yahoo.com/lifestyle/")) {
      return;
    }

    // Skip if already seen
    if (seenUrls.has(url)) {
      return;
    }

    // Skip section pages
    if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment|finance|lifestyle)\/?$/) || url.match(/\/lifestyle\/?$/)) {
      return;
    }

    // Skip if in sidebar/navigation areas
    const $closestContainer = $link.closest("aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer");
    if ($closestContainer.length > 0) {
      return;
    }

    // Extract title from link text or nearby elements
    let title = $link.text().trim();

    // If title is empty or too short, try to find it in parent/child elements
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3").first();
      if ($titleEl.length === 0) {
        // Try parent's text if it's a heading
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    // Clean title: remove source/category prefixes
    const categoryPrefixes = ["politics", "us", "world", "business", "technology", "entertainment", "sports", "health", "science", "finance", "lifestyle"];
    const sourceNames = [
      "associated press", "ap", "reuters", "the guardian", "cbs news", "cnn", "nbc news", 
      "abc news", "fox news", "the hill", "politico", "bloomberg", "the washington post",
      "the new york times", "usa today", "time", "newsweek", "the atlantic", "axios", "bbc",
      "yahoo finance", "yahoo personal finance", "yahoo entertainment", "yahoo movies", "yahoo lifestyle"
    ];
    
    let cleanedTitle = title;
    
    // Strategy: Find where the actual title starts by looking for patterns
    for (const category of categoryPrefixes) {
      for (const source of sourceNames) {
        const pattern1 = new RegExp(`^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`, "i");
        const match1 = cleanedTitle.match(pattern1);
        if (match1 && match1[1] && match1[1].length > 10) {
          cleanedTitle = match1[1].trim();
          break;
        }
        
        const pattern2 = new RegExp(`^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`, "i");
        const match2 = cleanedTitle.match(pattern2);
        if (match2 && match2[1] && match2[1].length > 10) {
          cleanedTitle = match2[1].trim();
          cleanedTitle = cleanedTitle.replace(/^['"]+|['"]+$/g, "").trim();
          break;
        }
      }
      if (cleanedTitle !== title && cleanedTitle.length > 10) break;
    }
    
    // If still not cleaned, try removing just category prefix
    if (cleanedTitle === title) {
      for (const category of categoryPrefixes) {
        if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
          const afterCategory = cleanedTitle.substring(category.length).trim();
          let foundSource = false;
          for (const source of sourceNames) {
            if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
              const afterSource = afterCategory.substring(source.length).trim();
              if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
                cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
                foundSource = true;
                break;
              }
            }
          }
          if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
            cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
          }
          break;
        }
      }
    }
    
    // Final fallback: if title still contains source patterns, try to extract just the title part
    if (cleanedTitle === title || cleanedTitle.length < 10) {
      const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
      if (titleMatch && titleMatch[1]) {
        const potentialTitle = titleMatch[1].trim();
        const isSource = sourceNames.some(s => potentialTitle.toLowerCase().includes(s.toLowerCase()));
        if (!isSource && potentialTitle.length > 15) {
          cleanedTitle = potentialTitle;
        }
      }
    }
    
    // Final check: if cleaned title is too short, use original
    if (cleanedTitle.length < 10) {
      cleanedTitle = title;
    }
    
    title = cleanedTitle;

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    // Skip navigation/section links by checking title text
    const titleLower = title.toLowerCase();
    if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
      return;
    }

    // Additional filtering: skip links that are clearly not main articles
    const skipPatterns = ["read more", "see all", "view all", "more stories", "trending", "popular", "watch now"];
    if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container
    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

    // Store with DOM index to preserve order
    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  // Remove duplicates by URL (keep first occurrence based on DOM order)
  const uniqueArticles = new Map<string, typeof allArticleLinks[0]>();
  for (const article of allArticleLinks) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Take the first N articles (latest ones, as they appear first in DOM)
  // Sort by DOM index to ensure correct order
  const latestArticles = Array.from(uniqueArticles.values())
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit);

  // Convert to expected format
  for (const article of latestArticles) {
    items.push({ title: article.title, url: article.url, imageUrl: article.imageUrl });
  }

  return items;
}

/**
 * Scrapes Yahoo News Science section (https://www.yahoo.com/news/science/)
 * and returns the latest article items.
 */
export async function scrapeYahooScienceNews(
  limit = 5
): Promise<YahooUSArticleItem[]> {
  const scienceUrl = "https://www.yahoo.com/news/science/";

  const response = await axios.get(scienceUrl);
  const $ = cheerio.load(response.data);

  const items: YahooUSArticleItem[] = [];
  const seenUrls = new Set<string>();

  // Common navigation/section text to exclude
  const excludedTexts = [
    "today's news",
    "newsletters",
    "weather news",
    "sign up",
    "more in",
    "follow us",
    "subscribe",
    "newsletter",
    "tariff updates",
    "live updates",
    "watch now",
    "trending",
    "most active",
    "top gainers",
    "top losers",
  ];

  // Yahoo News Science page structure - find all article links in DOM order
  // Collect all valid article links first, then filter and take the first 5
  const allArticleLinks: Array<{ url: string; title: string; imageUrl?: string; domIndex: number }> = [];
  let domIndex = 0;

  // Find all article links on the page (in DOM order)
  $('a[href*="/news/articles/"], a[href*="/news/science/"]').each((_, link) => {
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
        : new URL(rawHref, scienceUrl).toString();
    } catch {
      return; // skip invalid URLs
    }

    // Accept yahoo.com/news/articles/ and yahoo.com/news/science/ URLs
    if (!url.includes("yahoo.com/news/articles/") && !url.includes("yahoo.com/news/science/")) {
      return;
    }

    // Skip if already seen
    if (seenUrls.has(url)) {
      return;
    }

    // Skip section pages
    if (url.endsWith("/") || url.match(/\/news\/(world|us|politics|entertainment|finance|lifestyle|science)\/?$/)) {
      return;
    }

    // Skip if in sidebar/navigation areas
    const $closestContainer = $link.closest("aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer");
    if ($closestContainer.length > 0) {
      return;
    }

    // Extract title from link text or nearby elements
    let title = $link.text().trim();

    // If title is empty or too short, try to find it in parent/child elements
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent.find("h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3").first();
      if ($titleEl.length === 0) {
        // Try parent's text if it's a heading
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    // Clean title: remove source/category prefixes
    const categoryPrefixes = ["politics", "us", "world", "business", "technology", "entertainment", "sports", "health", "science", "finance", "lifestyle"];
    const sourceNames = [
      "associated press", "ap", "reuters", "the guardian", "cbs news", "cnn", "nbc news", 
      "abc news", "fox news", "the hill", "politico", "bloomberg", "the washington post",
      "the new york times", "usa today", "time", "newsweek", "the atlantic", "axios", "bbc",
      "yahoo finance", "yahoo personal finance", "yahoo entertainment", "yahoo movies", "yahoo lifestyle"
    ];
    
    let cleanedTitle = title;
    
    // Strategy: Find where the actual title starts by looking for patterns
    for (const category of categoryPrefixes) {
      for (const source of sourceNames) {
        const pattern1 = new RegExp(`^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`, "i");
        const match1 = cleanedTitle.match(pattern1);
        if (match1 && match1[1] && match1[1].length > 10) {
          cleanedTitle = match1[1].trim();
          break;
        }
        
        const pattern2 = new RegExp(`^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`, "i");
        const match2 = cleanedTitle.match(pattern2);
        if (match2 && match2[1] && match2[1].length > 10) {
          cleanedTitle = match2[1].trim();
          cleanedTitle = cleanedTitle.replace(/^['"]+|['"]+$/g, "").trim();
          break;
        }
      }
      if (cleanedTitle !== title && cleanedTitle.length > 10) break;
    }
    
    // If still not cleaned, try removing just category prefix
    if (cleanedTitle === title) {
      for (const category of categoryPrefixes) {
        if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
          const afterCategory = cleanedTitle.substring(category.length).trim();
          let foundSource = false;
          for (const source of sourceNames) {
            if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
              const afterSource = afterCategory.substring(source.length).trim();
              if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
                cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
                foundSource = true;
                break;
              }
            }
          }
          if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
            cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
          }
          break;
        }
      }
    }
    
    // Final fallback: if title still contains source patterns, try to extract just the title part
    if (cleanedTitle === title || cleanedTitle.length < 10) {
      const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
      if (titleMatch && titleMatch[1]) {
        const potentialTitle = titleMatch[1].trim();
        const isSource = sourceNames.some(s => potentialTitle.toLowerCase().includes(s.toLowerCase()));
        if (!isSource && potentialTitle.length > 15) {
          cleanedTitle = potentialTitle;
        }
      }
    }
    
    // Final check: if cleaned title is too short, use original
    if (cleanedTitle.length < 10) {
      cleanedTitle = title;
    }
    
    title = cleanedTitle;

    // Skip if no title found or title is too short
    if (!title || title.length < 10) {
      return;
    }

    // Skip navigation/section links by checking title text
    const titleLower = title.toLowerCase();
    if (excludedTexts.some(excluded => titleLower.includes(excluded))) {
      return;
    }

    // Additional filtering: skip links that are clearly not main articles
    const skipPatterns = ["read more", "see all", "view all", "more stories", "trending", "popular", "watch now"];
    if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    // Find image - look in parent container
    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("data-original") || undefined;

    // Store with DOM index to preserve order
    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  // Remove duplicates by URL (keep first occurrence based on DOM order)
  const uniqueArticles = new Map<string, typeof allArticleLinks[0]>();
  for (const article of allArticleLinks) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Take the first N articles (latest ones, as they appear first in DOM)
  // Sort by DOM index to ensure correct order
  const latestArticles = Array.from(uniqueArticles.values())
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit);

  // Convert to expected format
  for (const article of latestArticles) {
    items.push({ title: article.title, url: article.url, imageUrl: article.imageUrl });
  }

  return items;
}

/**
 * Scrapes a Yahoo article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body: from "It's no secret..." through
 *   "...could also help offset the demand for oil and gas."
 */
export async function scrapeYahooArticleDetails(
  articleUrl: string
): Promise<YahooArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);

  // 1) Try to parse JSON-LD NewsArticle block for title, description, category
  let title: string | null = null;
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
        title = (articleNode as any).headline ?? null;
        excerpt = (articleNode as any).description ?? null;
        // Some sites put section/category here; Yahoo may not
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

  // 2) Get title from h1 first (most reliable, matches what users see)
  if (!title) {
    const h1Text = $("article h1, h1").first().text().trim();
    if (h1Text) {
      title = h1Text;
    }
  }

  // Additional fallback: try Yahoo-specific selectors
  if (!title) {
    const yahooTitle = $(".caas-title, [data-module='Article'] h1").first().text().trim();
    if (yahooTitle) {
      title = yahooTitle;
    }
  }

  if (!title) {
    throw new Error("Could not determine article title");
  }

  // 3) Fallback for excerpt: use first paragraph inside article body
  const articleBodyContainer = $('div[data-article-body="true"]').first();

  if (!excerpt && articleBodyContainer.length) {
    const firstP = articleBodyContainer.find("p").first().text().trim();
    if (firstP) {
      excerpt = firstP;
    }
  }

  if (!excerpt) {
    excerpt = ""; // we keep it non-null for typing
  }

  // 4) Extract body paragraphs - get all paragraphs from article body
  let bodyParagraphs: string[] = [];

  if (articleBodyContainer.length) {
    bodyParagraphs = articleBodyContainer
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
  }

  // Fallback: try to find body in other common containers
  if (bodyParagraphs.length === 0) {
    const fallbackContainers = [
      'article .caas-body',
      'article .article-body',
      'article .content',
      'article [data-module="ArticleBody"]',
      'div.body', // Yahoo Finance uses div.body
      'div[class*="body"]', // Any div with "body" in class name
    ];

    for (const selector of fallbackContainers) {
      const $container = $(selector).first();
      if ($container.length) {
        bodyParagraphs = $container
          .find("p")
          .map((_, p) => $(p).text().trim())
          .get()
          .filter(Boolean);
        
        if (bodyParagraphs.length > 0) {
          break;
        }
      }
    }
  }

  // Final fallback: get paragraphs directly from article or main article
  // This works for Yahoo Finance articles where paragraphs are directly under article
  // Also works for regular Yahoo News articles
  if (bodyParagraphs.length === 0) {
    // Try article p first (most common for Yahoo Finance)
    const $articlePs = $('article p, main article p');
    if ($articlePs.length > 0) {
      bodyParagraphs = $articlePs
        .map((_, p) => {
          const text = $(p).text().trim();
          return text;
        })
        .get()
        .filter((text) => {
          // Filter out very short paragraphs (likely navigation/metadata)
          // Filter out paragraphs that are just links or buttons
          return text.length > 20 && 
                 !text.match(/^(Share|Follow|Subscribe|Sign up|Read more|View|Watch|Download|Get|Click)/i) &&
                 !text.match(/^(Advertisement|Ad|Sponsored)/i);
        });
    }
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




