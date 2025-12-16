/**
 * Maps ProcessedArticle to Sanity post document structure
 */

import { ProcessedArticle } from "../imageService/types";
import { Article } from "../middleware/types";
import { SanityPostDocument, SanityCover, PortableTextBlock, SanityCategoryReference, SanitySEO } from "./types";
import { getEditorialFlags } from "./editorialConfig";
import { resolveTagReferences } from "./tagCache";

/**
 * Generates a URL-friendly slug from a title
 * @param title - Article title
 * @returns Slug string
 */
export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 96); // Max length 96 (Sanity limit)
}

/**
 * Generates a short ticker title from the main title (max 40 characters)
 * @param title - Article title
 * @returns Short title for ticker
 */
export function generateTickerTitle(title: string): string {
  const maxLength = 40;
  if (title.length <= maxLength) {
    return title;
  }
  
  // Try to cut at a word boundary
  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  
  if (lastSpace > maxLength * 0.7) {
    // If we can cut at a reasonable word boundary, do it
    return truncated.substring(0, lastSpace) + "...";
  }
  
  // Otherwise just truncate
  return truncated.substring(0, maxLength - 3) + "...";
}

/**
 * Converts plain text to Sanity portable text blocks
 * @param text - Plain text string
 * @returns Array of portable text blocks
 */
export function convertTextToPortableText(text: string): PortableTextBlock[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split text into paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  if (paragraphs.length === 0) {
    // Single paragraph
    return [
      {
        _type: "block",
        _key: generateKey(),
        style: "normal",
        children: [
          {
            _type: "span",
            _key: generateKey(),
            text: text.trim(),
            marks: [],
          },
        ],
        markDefs: [],
      },
    ];
  }

  // Multiple paragraphs
  return paragraphs.map((paragraph, index) => {
    // Split by single newlines within paragraph and join with spaces
    const cleanedParagraph = paragraph.split(/\n/).map(p => p.trim()).filter(p => p).join(" ");
    
    return {
      _type: "block",
      _key: generateKey(),
      style: "normal",
      children: [
        {
          _type: "span",
          _key: generateKey(),
          text: cleanedParagraph,
          marks: [],
        },
      ],
      markDefs: [],
    };
  });
}

/**
 * Generates a unique key for Sanity blocks
 */
function generateKey(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Maps image data to Sanity cover structure
 * Uses external URL approach (simpler than asset upload)
 * 
 * @param image - ImageResult from image service
 * @param imageKeyword - Keyword used to find the image
 * @returns Sanity cover structure or undefined
 */
function mapImageToCover(
  image: ProcessedArticle["image"],
  imageKeyword?: string
): SanityCover | undefined {
  if (!image || !image.url) {
    return undefined;
  }

  // Use external URL approach (source: "external")
  const cover: SanityCover = {
    source: "external",
    externalUrl: image.url,
  };

  // Handle Wikimedia Commons specific fields
  if (image.source === "wikimedia") {
    // Extract ImageDescription for both alt and epigraph
    const imageDescription = image.imageDescription;
    if (imageDescription) {
      cover.alt = imageDescription;
      cover.epigraph = imageDescription; // Same value for both fields
    } else {
      // Fallback to keyword if no description
      cover.alt = imageKeyword || "Article cover image";
    }

    // Map Wikimedia Commons metadata to credit fields
    cover.creditAuthor = image.artist; // Artist -> creditAuthor (HTML already stripped in provider)
    cover.creditProvider = "Wikimedia Commons"; // Always "Wikimedia Commons" for Wikimedia images
    cover.creditLicense = image.licenseShortName; // LicenseShortName -> creditLicense
    cover.creditSourceUrl = image.sourcePageUrl; // File page URL -> creditSourceUrl

    // Legacy field for backward compatibility
    if (image.artist || image.source) {
      const creditParts: string[] = [];
      if (image.artist) {
        creditParts.push(image.artist);
      }
      if (image.source) {
        creditParts.push(`via ${image.source}`);
      }
      cover.imageSource = creditParts.join(" / ");
    }
  } else {
    // For Pexels/Pixabay, use existing logic
    cover.alt = image.authorName || imageKeyword || "Article cover image";

    // Add image source/credit if available
    if (image.authorName || image.source) {
      const creditParts: string[] = [];
      if (image.authorName) {
        creditParts.push(image.authorName);
      }
      if (image.source) {
        creditParts.push(`via ${image.source}`);
      }
      cover.imageSource = creditParts.join(" / ");
    }

    // For non-Wikimedia sources, set credit fields if available
    if (image.authorName) {
      cover.creditAuthor = image.authorName;
    }
    if (image.source) {
      cover.creditProvider = image.source === "pexels" ? "Pexels" : image.source === "pixabay" ? "Pixabay" : image.source;
    }
    if (image.license) {
      cover.creditLicense = image.license;
    }
    if (image.sourcePageUrl) {
      cover.creditSourceUrl = image.sourcePageUrl;
    }
  }

  return cover;
}

// Note: Category mapping is now handled by resolveCategoryReference in categoryResolver.ts
// This function is kept for backward compatibility but should use the resolver

/**
 * Generates a random read time (3, 4, or 5 minutes)
 * @returns Random number between 3 and 5 (inclusive)
 */
function generateRandomReadTime(): number {
  const options = [3, 4, 5];
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
}

/**
 * Maps a ProcessedArticle and original Article to Sanity post document structure
 * 
 * @param processedArticle - Processed article with ChatGPT and image data
 * @param originalArticle - Original article from scraping
 * @param categoryRef - Resolved category reference (must be provided)
 * @param authorRef - Resolved author reference (optional)
 * @param runId - The run ID (e.g., "run1", "run2") for editorial config lookup
 * @param options - Optional configuration
 * @returns Sanity post document structure
 */
export function mapProcessedArticleToSanity(
  processedArticle: ProcessedArticle,
  originalArticle: Article,
  categoryRef: SanityCategoryReference | undefined,
  authorRef?: SanityCategoryReference,
  runId?: string,
  options?: {
    status?: "draft" | "scheduled" | "published";
    featured?: boolean;
    priority?: number;
  }
): SanityPostDocument {
  const slug = generateSlugFromTitle(processedArticle.title);
  const documentId = `post-${slug}`;
  const now = new Date().toISOString();
  
  // Use scrapedAt if available, otherwise use current time
  const publishedDate = originalArticle.scrapedAt || now;

  // Convert body text to portable text blocks
  const bodyBlocks = convertTextToPortableText(processedArticle.body || "");

  // Map image to cover
  const cover = mapImageToCover(processedArticle.image, processedArticle.imageKeyword);

  // Create SEO object with title and description
  const seo: SanitySEO = {
    title: processedArticle.title,
    description: processedArticle.excerpt || undefined,
  };

  // Get editorial flags from config based on runId and origin
  // Pass publishedDate to calculate frontUntil and justInUntil when needed
  const editorialFlags = runId ? getEditorialFlags(runId, originalArticle.origin, publishedDate) : undefined;

  // Resolve tags from ChatGPT response (array of strings) to Sanity references
  const tagReferences = resolveTagReferences(processedArticle.tags || []);

  const postDoc: SanityPostDocument = {
    _id: documentId,
    _type: "post",
    
    // Required fields
    title: processedArticle.title,
    tickerTitle: processedArticle.tickerTitle, // From ChatGPT response (max 45 chars)
    excerpt: processedArticle.excerpt || undefined,
    bodyTextOne: bodyBlocks,
    slug: {
      _type: "slug",
      current: slug,
    },
    category: categoryRef!, // Required - must be provided (resolved externally)
    
    // Cover image (optional but recommended)
    cover: cover,
    
    // Tags (from ChatGPT response, converted to Sanity references)
    tags: tagReferences.length > 0 ? tagReferences : undefined,
    
    // Dates
    date: publishedDate,
    publishedAt: options?.status === "published" ? publishedDate : undefined,
    status: options?.status || "published", // Default to "published"
    
    // Optional fields with defaults
    featured: editorialFlags?.featured ?? options?.featured ?? false,
    priority: editorialFlags?.priority ?? options?.priority ?? 0,
    author: authorRef, // Randomly assigned author (excluding andres-n)
    readTime: generateRandomReadTime(), // Random value: 3, 4, or 5 minutes
    seo: seo, // SEO object with title and description
    
    // Editorial positioning flags (from config)
    mainHeadline: editorialFlags?.mainHeadline,
    mainHeadlineRank: editorialFlags?.mainHeadlineRank,
    mainHeadlineUntil: editorialFlags?.mainHeadlineUntil,
    frontline: editorialFlags?.frontline,
    frontRank: editorialFlags?.frontRank,
    frontUntil: editorialFlags?.frontUntil,
    rightHeadline: editorialFlags?.rightHeadline,
    rightHeadlineRank: editorialFlags?.rightHeadlineRank,
    rightHeadlineUntil: editorialFlags?.rightHeadlineUntil,
    justIn: editorialFlags?.justIn,
    justInRank: editorialFlags?.justInRank,
    justInUntil: editorialFlags?.justInUntil,
    breakingNews: editorialFlags?.breakingNews,
    developingStory: editorialFlags?.developingStory,
  };

  return postDoc;
}
