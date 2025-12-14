/**
 * Wikimedia Commons Image Provider
 * 
 * Note: Wikimedia Commons has strict licensing/attribution requirements.
 * Properly handles license information and attribution via MediaWiki Action API.
 */

import { logger } from "../../config/logger";
import { ImageResult } from "../types";

const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";

/**
 * Formats User-Agent string for Wikimedia API
 * If user provides just an email, auto-formats it to proper User-Agent format
 */
function formatUserAgent(userAgent?: string): string {
  if (!userAgent) {
    return "NewsIngestionBot/1.0 (https://example.com/contact)";
  }
  
  // If it's already in the proper format (contains "/" and "("), use as-is
  if (userAgent.includes("/") && userAgent.includes("(")) {
    return userAgent;
  }
  
  // If it's just an email or contact info, format it properly
  return `NewsIngestionBot/1.0 (${userAgent})`;
}

/**
 * Strips HTML tags from a string and decodes HTML entities
 * Extracts text content from links (preferring link text over title attribute)
 * 
 * @param html - HTML string to clean
 * @returns Plain text without HTML tags
 */
function stripHtmlTags(html?: string): string | undefined {
  if (!html) return undefined;
  
  // First, extract text content from links (the text between <a> tags)
  // This handles cases like: <a href="...">Link Text</a> -> "Link Text"
  let text = html.replace(/<a[^>]*>([^<]*)<\/a>/gi, "$1");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#160;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
  
  // Clean up multiple spaces, newlines, and trim
  text = text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim();
  
  return text || undefined;
}

// User-Agent is required by Wikimedia API
const USER_AGENT = formatUserAgent(process.env.WIKIMEDIA_USER_AGENT);

export interface WikimediaSearchOptions {
  perPage?: number;
}

/**
 * Fetches detailed image metadata from Wikimedia Commons using MediaWiki Action API
 * 
 * @param fileName - File name (e.g., "File:Example.jpg")
 * @returns Image metadata or null if fetch fails
 */
async function fetchImageMetadata(fileName: string): Promise<{
  imageUrl: string;
  imageDescription?: string;
  artist?: string;
  attribution?: string;
  licenseShortName?: string;
} | null> {
  try {
    const url = new URL(WIKIMEDIA_API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", fileName);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata");
    url.searchParams.set("iiurlwidth", "1600");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      logger.error("Wikimedia MediaWiki API error:", {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }

    const data = (await res.json()) as {
      query?: {
        pages?: {
          [pageId: string]: {
            title?: string;
            ns?: number;
            imageinfo?: Array<{
              url?: string;
              extmetadata?: {
                ImageDescription?: { value?: string };
                Artist?: { value?: string };
                Attribution?: { value?: string };
                LicenseShortName?: { value?: string };
              };
            }>;
          };
        };
      };
    };

    // Log the full response for debugging
    console.log("📋 Wikimedia Commons API Response:", JSON.stringify(data, null, 2));

    const pages = data.query?.pages;
    if (!pages) {
      logger.debug("No pages found in Wikimedia API response");
      return null;
    }

    // Get the first page (there should only be one)
    const page = Object.values(pages)[0];
    
    // Check if this is actually a File (namespace 6)
    if (page?.ns !== 6) {
      logger.debug(`Page is not a File (namespace: ${page?.ns}), cannot fetch imageinfo`);
      return null;
    }
    
    const imageInfo = page?.imageinfo?.[0];
    
    if (!imageInfo) {
      logger.debug("No imageinfo found in Wikimedia API response");
      return null;
    }

    const extmetadata = imageInfo.extmetadata || {};
    
    // Strip HTML tags from metadata fields
    const imageDescription = stripHtmlTags(extmetadata.ImageDescription?.value);
    const artist = stripHtmlTags(extmetadata.Artist?.value);
    const attribution = stripHtmlTags(extmetadata.Attribution?.value);
    
    return {
      imageUrl: imageInfo.url || "",
      imageDescription,
      artist,
      attribution,
      licenseShortName: extmetadata.LicenseShortName?.value, // License is usually plain text
    };
  } catch (error) {
    logger.error("Wikimedia MediaWiki API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Gets files from a category using MediaWiki Action API
 * 
 * @param categoryTitle - Category title (e.g., "Category:Bondi Beach, New South Wales")
 * @param limit - Maximum number of files to return
 * @returns Array of file titles or empty array
 */
async function getFilesFromCategory(
  categoryTitle: string,
  limit: number = 10
): Promise<string[]> {
  try {
    const url = new URL(WIKIMEDIA_API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", categoryTitle);
    url.searchParams.set("cmtype", "file");
    url.searchParams.set("cmlimit", String(limit));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      logger.error("Wikimedia Category Members API error:", {
        status: res.status,
        statusText: res.statusText,
      });
      return [];
    }

    const data = (await res.json()) as {
      query?: {
        categorymembers?: Array<{
          title?: string;
          ns?: number;
        }>;
      };
    };

    const members = data.query?.categorymembers || [];
    
    // Filter to only File namespace (ns === 6) and extract titles
    return members
      .filter((member) => member.ns === 6 && member.title)
      .map((member) => member.title!)
      .slice(0, limit);
  } catch (error) {
    logger.error("Failed to get files from category:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Searches Wikimedia Commons API for images (files only, namespace 6)
 * 
 * @param query - Search query/keyword
 * @param opts - Search options
 * @returns ImageResult or null if no results found
 */
export async function searchWikimedia(
  query: string,
  opts?: WikimediaSearchOptions
): Promise<ImageResult | null> {
  // Request at least 3 results to randomly pick from
  const limit = Math.max(opts?.perPage ?? 5, 3);

  try {
    // Step 1: Search for files only (namespace 6)
    const searchUrl = new URL(WIKIMEDIA_API_URL);
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srsearch", query);
    searchUrl.searchParams.set("srnamespace", "6"); // Only search File namespace
    searchUrl.searchParams.set("srlimit", String(limit));
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");

    const searchRes = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      logger.error("Wikimedia Commons Search API error:", {
        status: searchRes.status,
        statusText: searchRes.statusText,
        error: errorText,
      });
      return null;
    }

    const searchData = (await searchRes.json()) as {
      query?: {
        search?: Array<{
          title?: string;
          ns?: number;
        }>;
      };
    };

    let fileTitles: string[] = [];
    const searchResults = searchData.query?.search || [];

    if (searchResults.length > 0) {
      // Filter to only File namespace (ns === 6) and extract titles
      fileTitles = searchResults
        .filter((result) => result.ns === 6 && result.title)
        .map((result) => result.title!)
        .slice(0, limit);
    }

    // Step 2: If no files found, try searching without namespace restriction
    // and if we get a category, expand it to files
    if (fileTitles.length === 0) {
      logger.debug(`No files found for "${query}", trying broader search...`);
      
      const broadSearchUrl = new URL(WIKIMEDIA_API_URL);
      broadSearchUrl.searchParams.set("action", "query");
      broadSearchUrl.searchParams.set("list", "search");
      broadSearchUrl.searchParams.set("srsearch", query);
      broadSearchUrl.searchParams.set("srlimit", "5");
      broadSearchUrl.searchParams.set("format", "json");
      broadSearchUrl.searchParams.set("origin", "*");

      const broadSearchRes = await fetch(broadSearchUrl.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
        },
      });

      if (broadSearchRes.ok) {
        const broadData = (await broadSearchRes.json()) as {
          query?: {
            search?: Array<{
              title?: string;
              ns?: number;
            }>;
          };
        };

        const broadResults = broadData.query?.search || [];
        
        // Look for categories (namespace 14)
        const categories = broadResults.filter((r) => r.ns === 14 && r.title);
        
        if (categories.length > 0) {
          // Get files from the first category
          const categoryTitle = categories[0].title!;
          logger.debug(`Found category: ${categoryTitle}, expanding to files...`);
          fileTitles = await getFilesFromCategory(categoryTitle, limit);
        } else {
          // Try to find files in the broad search results
          fileTitles = broadResults
            .filter((result) => result.ns === 6 && result.title)
            .map((result) => result.title!)
            .slice(0, limit);
        }
      }
    }

    if (fileTitles.length === 0) {
      logger.debug(`No Wikimedia Commons files found for query: ${query}`);
      return null;
    }

    // Randomly pick from the first 3 results (or fewer if less than 3 available)
    const topResults = fileTitles.slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topResults.length);
    const selectedFileTitle = topResults[randomIndex];

    if (!selectedFileTitle) {
      logger.debug("No file title selected");
      return null;
    }

    // Step 3: Fetch detailed metadata including full image URL and licensing info
    const metadata = await fetchImageMetadata(selectedFileTitle);
    
    if (!metadata || !metadata.imageUrl) {
      logger.warn(`Failed to fetch metadata for ${selectedFileTitle}`);
      return null;
    }

    // Get the file page URL
    const fileUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(selectedFileTitle)}`;

    const result: ImageResult = {
      url: metadata.imageUrl, // Full-resolution image URL
      source: "wikimedia",
      sourcePageUrl: fileUrl,
      // Wikimedia Commons specific metadata
      imageDescription: metadata.imageDescription,
      artist: metadata.artist,
      attribution: metadata.attribution,
      licenseShortName: metadata.licenseShortName,
      license: metadata.licenseShortName, // Also set license for backward compatibility
      authorName: metadata.artist, // Also set authorName for backward compatibility
    };

    logger.info(`✅ Wikimedia Commons: Found image for "${query}" (randomly selected from ${topResults.length} top results)`);
    return result;
  } catch (error) {
    logger.error("Wikimedia Commons API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
