import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";

export interface APNewsArticleItem {
  title: string;
  url: string;
  imageUrl?: string;
}

export interface APNewsArticleDetails {
  url: string;
  title: string;
  excerpt: string;
  category: string | null;
  body: string;
}

/**
 * Scrapes AP News US News section and returns article items.
 * Targets specific articles from the US News page.
 */
export async function scrapeAPNewsHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const usNewsUrl = "https://apnews.com/us-news";
  
  const response = await axios.get(usNewsUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // Target articles are in .PagePromo containers
  // Look for articles with specific titles or in the main content area
  $('.PagePromo').each((_, promo) => {
    if (items.length >= limit) return;
    
    const $promo = $(promo);
    
    // Find the main article link in this promo
    const $link = $promo.find('a.Link[href*="/article/"]').first();
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return; // skip if no href
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, usNewsUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title - prioritize .PagePromo-title structure
    let title = "";
    
    // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
    const $titleLink = $promo.find(".PagePromo-title a.Link").first();
    if ($titleLink.length) {
      const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label or data-gtm-region
    if (!title) {
      title = 
        $link.attr("aria-label")?.trim() ||
        $promo.attr("data-gtm-region")?.trim() ||
        "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found
    if (!title) {
      return;
    }
    
    // Find image - look in PagePromo-media container
    const $media = $promo.find(".PagePromo-media");
    const $img = $media.find("img, picture img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
    
    items.push({ title, url, imageUrl });
  });
  
  return items;
}

/**
 * Scrapes AP News World News section and returns article items.
 * Targets specific articles from the World News page.
 */
export async function scrapeAPNewsWorldHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const worldNewsUrl = "https://apnews.com/world-news";
  
  const response = await axios.get(worldNewsUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // Target articles are in .PagePromo containers
  // Look for articles with specific titles or in the main content area
  $('.PagePromo').each((_, promo) => {
    if (items.length >= limit) return;
    
    const $promo = $(promo);
    
    // Find the main article link in this promo
    const $link = $promo.find('a.Link[href*="/article/"]').first();
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return; // skip if no href
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, worldNewsUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title - prioritize .PagePromo-title structure
    let title = "";
    
    // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
    const $titleLink = $promo.find(".PagePromo-title a.Link").first();
    if ($titleLink.length) {
      const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label or data-gtm-region
    if (!title) {
      title = 
        $link.attr("aria-label")?.trim() ||
        $promo.attr("data-gtm-region")?.trim() ||
        "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found
    if (!title) {
      return;
    }
    
    // Find image - look in PagePromo-media container
    const $media = $promo.find(".PagePromo-media");
    const $img = $media.find("img, picture img").first();
    const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
    
    items.push({ title, url, imageUrl });
  });
  
  return items;
}

/**
 * Scrapes AP News Politics section and returns article items.
 * Targets specific articles from the Politics page.
 */
export async function scrapeAPNewsPoliticsHomepage(
  limit = 4
): Promise<APNewsArticleItem[]> {
  const politicsUrl = "https://apnews.com/politics";
  
  const response = await axios.get(politicsUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, politicsUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, politicsUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes AP News Business section and returns article items.
 * Targets specific articles from the Business page.
 */
export async function scrapeAPNewsBusinessHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const businessUrl = "https://apnews.com/business";
  
  const response = await axios.get(businessUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, businessUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, businessUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes AP News Science section and returns article items.
 * Targets specific articles from the Science page.
 */
export async function scrapeAPNewsScienceHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const scienceUrl = "https://apnews.com/science";
  
  const response = await axios.get(scienceUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, scienceUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, scienceUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes AP News Technology section and returns article items.
 * Targets specific articles from the Technology page.
 */
export async function scrapeAPNewsTechnologyHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const technologyUrl = "https://apnews.com/technology";
  
  const response = await axios.get(technologyUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, technologyUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, technologyUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes AP News Lifestyle section and returns article items.
 * Targets specific articles from the Lifestyle page.
 */
export async function scrapeAPNewsLifestyleHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const lifestyleUrl = "https://apnews.com/lifestyle";
  
  const response = await axios.get(lifestyleUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, lifestyleUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, lifestyleUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes AP News Entertainment section and returns article items.
 * Targets specific articles from the Entertainment page.
 */
export async function scrapeAPNewsEntertainmentHomepage(
  limit = 5
): Promise<APNewsArticleItem[]> {
  const entertainmentUrl = "https://apnews.com/entertainment";
  
  const response = await axios.get(entertainmentUrl);
  const $ = cheerio.load(response.data);
  
  const items: APNewsArticleItem[] = [];
  const seenUrls = new Set<string>();
  
  // First, try to find articles in .PagePromo-title containers (most reliable)
  $('.PagePromo-title a[href*="/article/"]').each((_, link) => {
    if (items.length >= limit) return;
    
    const $link = $(link);
    const rawHref = $link.attr("href");
    
    if (!rawHref) {
      return;
    }
    
    // Build absolute URL
    const url = rawHref.startsWith("http")
      ? rawHref
      : new URL(rawHref, entertainmentUrl).toString();
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) {
      return;
    }
    seenUrls.add(url);
    
    // Extract title from PagePromoContentIcons-text span
    let title = "";
    const $titleSpan = $link.find(".PagePromoContentIcons-text").first();
    if ($titleSpan.length) {
      title = $titleSpan.text().trim();
    }
    
    // Fallback: aria-label
    if (!title) {
      title = $link.attr("aria-label")?.trim() || "";
    }
    
    // Last resort: link text
    if (!title) {
      title = $link.text().trim();
    }
    
    // Skip if no title found or if title is too short (likely not an article)
    if (!title || title.length < 10) {
      return;
    }
    
    // Find image - look in the parent PagePromo container
    const $promo = $link.closest(".PagePromo, .PageListStandardE-leadPromo, .PageListStandardE-leadPromo-media");
    const $media = $promo.find(".PagePromo-media").first();
    let imageUrl: string | undefined = undefined;
    
    // Try to find image in picture > source or img tags
    if ($media.length) {
      const $img = $media.find("img").first();
      if ($img.length) {
        imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      } else {
        // Try source tag in picture element
        const $source = $media.find("picture source").first();
        if ($source.length) {
          const srcset = $source.attr("srcset");
          if (srcset) {
            // Extract first URL from srcset (format: "url width, url width")
            const firstUrl = srcset.split(",")[0]?.trim().split(" ")[0];
            if (firstUrl) {
              imageUrl = firstUrl;
            }
          }
        }
      }
    }
    
    items.push({ title, url, imageUrl });
  });
  
  // If we didn't get enough items, try the fallback method with .PagePromo containers
  if (items.length < limit) {
    $('.PagePromo').each((_, promo) => {
      if (items.length >= limit) return;
      
      const $promo = $(promo);
      
      // Find the main article link in this promo - try multiple selectors
      let $link = $promo.find('a.Link[href*="/article/"]').first();
      if (!$link.length) {
        // Fallback: try any link with /article/ in href
        $link = $promo.find('a[href*="/article/"]').first();
      }
      
      const rawHref = $link.attr("href");
      
      if (!rawHref) {
        return; // skip if no href
      }
      
      // Build absolute URL
      const url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, entertainmentUrl).toString();
      
      // Skip if we've already seen this URL
      if (seenUrls.has(url)) {
        return;
      }
      seenUrls.add(url);
      
      // Extract title - prioritize .PagePromo-title structure
      let title = "";
      
      // First try: .PagePromo-title > a > span.PagePromoContentIcons-text
      let $titleLink = $promo.find(".PagePromo-title a.Link").first();
      if (!$titleLink.length) {
        $titleLink = $promo.find(".PagePromo-title a").first();
      }
      if ($titleLink.length) {
        const $titleSpan = $titleLink.find(".PagePromoContentIcons-text").first();
        title = $titleSpan.text().trim();
      }
      
      // Fallback: aria-label or data-gtm-region
      if (!title) {
        title = 
          $link.attr("aria-label")?.trim() ||
          $promo.attr("data-gtm-region")?.trim() ||
          "";
      }
      
      // Last resort: link text
      if (!title) {
        title = $link.text().trim();
      }
      
      // Skip if no title found or if title is too short (likely not an article)
      if (!title || title.length < 10) {
        return;
      }
      
      // Find image - look in PagePromo-media container
      const $media = $promo.find(".PagePromo-media");
      const $img = $media.find("img, picture img").first();
      const imageUrl = $img.attr("src") || $img.attr("data-src") || undefined;
      
      items.push({ title, url, imageUrl });
    });
  }
  
  
  return items;
}

/**
 * Scrapes an AP News article detail page.
 * - category/section (best-effort, may be null)
 * - title
 * - excerpt/description
 * - body text
 */
export async function scrapeAPNewsArticleDetails(
  articleUrl: string
): Promise<APNewsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);
  
  // 1) Get title from h1.Page-headline first (most reliable, matches what users see)
  let title: string | null = null;
  const h1Text = $("h1.Page-headline, h1").first().text().trim();
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
        // Only use JSON-LD headline if we didn't get one from h1 (JSON-LD can be shorter)
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
    const firstP = $(".RichTextStoryBody p, .RichTextBody p, .Page-storyBody p").first().text().trim();
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
    const breadcrumbText = $(".Breadcrumb a, .breadcrumb a, nav[aria-label='Breadcrumb'] a").last().text().trim();
    if (breadcrumbText) {
      category = breadcrumbText;
    }
    
    // Fallback: try to extract from URL path (e.g., /article/category-slug-...)
    if (!category) {
      const urlMatch = articleUrl.match(/apnews\.com\/([^\/]+)/);
      if (urlMatch && urlMatch[1] && urlMatch[1] !== "article") {
        category = urlMatch[1].replace(/-/g, " ");
      }
    }
  }
  
  // 4) Extract body paragraphs - AP News uses .RichTextStoryBody or .RichTextBody
  let bodyParagraphs: string[] = [];
  
  // AP News article body is in .RichTextStoryBody or .RichTextBody
  const articleBodyContainer = 
    $(".RichTextStoryBody, .RichTextBody, .Page-storyBody").first();
  
  if (articleBodyContainer.length) {
    bodyParagraphs = articleBodyContainer
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
  }
  
  // Fallback: get all paragraphs from main content area
  if (bodyParagraphs.length === 0) {
    bodyParagraphs = $(".Page-main p, main p")
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

