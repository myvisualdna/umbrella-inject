/**
 * Wikimedia Commons Image Provider
 * 
 * Note: Wikimedia Commons has strict licensing/attribution requirements.
 * Properly handles license information and attribution via MediaWiki Action API.
 */

import { logger } from "../../config/logger";
import { ImageResult } from "../types";
import {
  selectBestCommonsImage,
  CommonsCandidate,
  SelectedCommonsImage,
} from "./wikimediaAlgorithm";

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
 * Returns data in CommonsCandidate format for the selector algorithm
 * 
 * @param fileTitles - Array of file names (e.g., ["File:Example.jpg", "File:Another.jpg"])
 * @returns Array of CommonsCandidate objects with full metadata
 */
async function fetchCandidatesMetadata(fileTitles: string[]): Promise<CommonsCandidate[]> {
  if (fileTitles.length === 0) return [];

  try {
    // Wikimedia API allows multiple titles separated by |
    const titlesParam = fileTitles.join("|");
    
    const url = new URL(WIKIMEDIA_API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", titlesParam);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata|size|mime");
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
      return [];
    }

    const data = (await res.json()) as {
      query?: {
        pages?: {
          [pageId: string]: {
            title?: string;
            ns?: number;
            pageid?: number;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              descriptionurl?: string;
              width?: number;
              height?: number;
              mime?: string;
              extmetadata?: {
                ImageDescription?: { value?: string };
                Artist?: { value?: string };
                Attribution?: { value?: string };
                LicenseShortName?: { value?: string };
                LicenseUrl?: { value?: string };
                ObjectName?: { value?: string };
              };
            }>;
          };
        };
      };
    };

    const pages = data.query?.pages;
    if (!pages) {
      logger.debug("No pages found in Wikimedia API response");
      return [];
    }

    const candidates: CommonsCandidate[] = [];

    for (const page of Object.values(pages)) {
      // Only process File namespace (ns === 6)
      if (page?.ns !== 6 || !page.title) continue;
      
      const imageInfo = page.imageinfo?.[0];
      if (!imageInfo || !imageInfo.url) continue;

      candidates.push({
        title: page.title,
        pageid: page.pageid,
        imageinfo: {
          url: imageInfo.url,
          thumburl: imageInfo.thumburl,
          descriptionurl: imageInfo.descriptionurl,
          width: imageInfo.width,
          height: imageInfo.height,
          mime: imageInfo.mime,
          extmetadata: imageInfo.extmetadata,
        },
      });
    }

    return candidates;
  } catch (error) {
    logger.error("Wikimedia MediaWiki API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetches detailed image metadata from Wikimedia Commons using MediaWiki Action API
 * (Legacy function - kept for backward compatibility if needed)
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
 * Converts SelectedCommonsImage to ImageResult format
 */
function mapSelectedToImageResult(selected: SelectedCommonsImage, candidate: CommonsCandidate): ImageResult {
  // Extract ImageDescription from the original candidate's extmetadata
  const imageDescription = candidate.imageinfo?.extmetadata?.ImageDescription?.value
    ? stripHtmlTags(candidate.imageinfo.extmetadata.ImageDescription.value)
    : selected.imageTitle;

  return {
    url: selected.externalUrl,
    source: "wikimedia",
    sourcePageUrl: selected.sourcePageUrl,
    imageDescription, // Use ImageDescription from metadata, fallback to imageTitle
    artist: selected.creator,
    attribution: selected.creditProvider, // "Wikimedia Commons"
    licenseShortName: selected.license,
    license: selected.license,
    authorName: selected.creator,
    width: selected.debug.width,
    height: selected.debug.height,
  };
}

/**
 * Searches Wikimedia Commons API for images (files only, namespace 6)
 * Uses intelligent selection algorithm to pick the best image
 * 
 * @param query - Search query/keyword
 * @param opts - Search options
 * @returns ImageResult or null if no results found
 */
export async function searchWikimedia(
  query: string,
  opts?: WikimediaSearchOptions
): Promise<ImageResult | null> {
  // Fetch more candidates for better selection (20 instead of 3-5)
  const searchLimit = 20;

  try {
    // Step 1: Search for files only (namespace 6)
    const searchUrl = new URL(WIKIMEDIA_API_URL);
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srsearch", query);
    searchUrl.searchParams.set("srnamespace", "6"); // Only search File namespace
    searchUrl.searchParams.set("srlimit", String(searchLimit));
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
        .slice(0, searchLimit);
    }

    // Step 2: If no files found, try searching without namespace restriction
    // and if we get a category, expand it to files
    if (fileTitles.length === 0) {
      logger.debug(`No files found for "${query}", trying broader search...`);
      
      const broadSearchUrl = new URL(WIKIMEDIA_API_URL);
      broadSearchUrl.searchParams.set("action", "query");
      broadSearchUrl.searchParams.set("list", "search");
      broadSearchUrl.searchParams.set("srsearch", query);
      broadSearchUrl.searchParams.set("srlimit", "10");
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
          fileTitles = await getFilesFromCategory(categoryTitle, searchLimit);
        } else {
          // Try to find files in the broad search results
          fileTitles = broadResults
            .filter((result) => result.ns === 6 && result.title)
            .map((result) => result.title!)
            .slice(0, searchLimit);
        }
      }
    }

    if (fileTitles.length === 0) {
      logger.debug(`No Wikimedia Commons files found for query: ${query}`);
      return null;
    }

    // Step 3: Fetch metadata for all candidates
    logger.debug(`Fetching metadata for ${fileTitles.length} candidates...`);
    const candidates = await fetchCandidatesMetadata(fileTitles);

    if (candidates.length === 0) {
      logger.debug("No candidates with valid metadata found");
      return null;
    }

    // Step 4: Use selection algorithm to pick the best image
    const selected = selectBestCommonsImage({
      keyword: query,
      candidates,
      minWidth: 900, // Minimum width for cover images
    });

    if (!selected) {
      logger.debug("Selection algorithm found no suitable image");
      return null;
    }

    // Find the candidate that was selected (by matching URL)
    const selectedCandidate = candidates.find(
      (c) => c.imageinfo?.url === selected.externalUrl
    );

    if (!selectedCandidate) {
      logger.warn("Could not find selected candidate in original list");
      return null;
    }

    // Log selection details for debugging
    logger.info(`✅ Wikimedia Commons: Selected best image for "${query}" (score: ${selected.debug.score})`);
    logger.debug(`Selection reasons: ${selected.debug.reasons.join(", ")}`);

    // Step 5: Convert to ImageResult format
    return mapSelectedToImageResult(selected, selectedCandidate);
  } catch (error) {
    logger.error("Wikimedia Commons API request failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
