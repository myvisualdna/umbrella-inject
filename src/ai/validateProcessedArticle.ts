import Ajv from "ajv";
import { getAllowedTagSlugsForAi } from "./tagCatalog";
import { buildProcessedArticleSchema } from "./processedArticleSchema";
import type { ProcessedArticlePayload } from "./types";

const ajv = new Ajv({ allErrors: true });
const validatorCache = new Map<string, ReturnType<typeof ajv.compile>>();

export interface ValidateProcessedArticleOptions {
  expectedSourceUrl: string;
  allowedTagSlugs?: string[];
}

export interface ProcessedArticleValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Validates a provider payload against the JSON schema plus business rules
 * that the schema cannot express on its own.
 */
export function validateProcessedArticle(
  payload: unknown,
  options: ValidateProcessedArticleOptions
): ProcessedArticleValidationResult {
  const reasons: string[] = [];

  const allowedTagSlugs = Array.from(
    new Set((options.allowedTagSlugs ?? getAllowedTagSlugsForAi()).map((slug) => slug.trim()))
  ).filter(Boolean);
  const cacheKey = allowedTagSlugs.slice().sort().join("|");
  let validateSchema = validatorCache.get(cacheKey);
  if (!validateSchema) {
    validateSchema = ajv.compile(
      buildProcessedArticleSchema({ allowedTagSlugs }) as Record<string, unknown>
    );
    validatorCache.set(cacheKey, validateSchema);
  }

  const schemaValid = validateSchema(payload);
  if (!schemaValid) {
    for (const error of validateSchema.errors ?? []) {
      const location = error.instancePath || error.params?.missingProperty || "root";
      reasons.push(`${location} ${error.message ?? "is invalid"}`.trim());
    }
    return { valid: false, reasons };
  }

  const article = payload as ProcessedArticlePayload;
  const tagSlugs = Array.isArray(article.tagSlugs)
    ? article.tagSlugs
    : Array.isArray(article.tags)
      ? article.tags
      : [];

  if (article.sourceAttribution.sourceUrl !== options.expectedSourceUrl) {
    reasons.push(
      `sourceAttribution.sourceUrl does not match candidate source URL (expected ${options.expectedSourceUrl})`
    );
  }

  if (article.editorialNotes.humanReviewRequired !== true) {
    reasons.push("editorialNotes.humanReviewRequired must be true");
  }

  article.body.forEach((paragraph, index) => {
    if (paragraph.trim().length === 0) {
      reasons.push(`body[${index}] is empty after trimming`);
    }
  });

  // Canonical validation: provided tagSlugs must come from the allowed catalog.
  // Legacy fallback (`tags`) is tolerated during transition to avoid breaking
  // already-processed rows; unknown legacy values are ignored.
  if (Array.isArray(article.tagSlugs)) {
    const allowedSet = new Set(allowedTagSlugs);
    for (const slug of tagSlugs) {
      if (!allowedSet.has(slug)) {
        reasons.push(`tagSlugs contains unknown slug: ${slug}`);
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}
