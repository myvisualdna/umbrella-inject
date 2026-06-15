export interface ProcessedArticleSchemaOptions {
  allowedTagSlugs: string[];
}

/**
 * Strict JSON Schema for the AI worker's ProcessedArticlePayload.
 *
 * `tagSlugs` is the canonical output. It is optional (recommended), allowing
 * `[]` when no allowed tag is relevant. When `allowedTagSlugs` is provided,
 * items are constrained to that set.
 */
export function buildProcessedArticleSchema(
  options: ProcessedArticleSchemaOptions
): Record<string, unknown> {
  const sortedAllowedSlugs = Array.from(
    new Set((options.allowedTagSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))
  ).sort();

  const tagItemsSchema =
    sortedAllowedSlugs.length > 0
      ? { type: "string", enum: sortedAllowedSlugs }
      : { type: "string", minLength: 1 };

  const tagArraySchema: Record<string, unknown> = {
    type: "array",
    minItems: 0,
    maxItems: 6,
    uniqueItems: true,
    items: tagItemsSchema,
  };

  if (sortedAllowedSlugs.length === 0) {
    // No catalog available: only [] is accepted.
    tagArraySchema.maxItems = 0;
  }

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "tickerTitle",
      "excerpt",
      "body",
      "category",
      "seo",
      "classification",
      "sourceAttribution",
      "editorialNotes",
    ],
    properties: {
      title: { type: "string", minLength: 4 },
      tickerTitle: { type: "string", minLength: 1, maxLength: 40 },
      excerpt: { type: "string", minLength: 1, maxLength: 280 },
      body: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
      category: { type: "string", minLength: 1 },
      tagSlugs: tagArraySchema,
      // Legacy compatibility for pre-migration rows.
      tags: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: { type: "string", minLength: 1 },
      },
      seo: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
        },
      },
      classification: {
        type: "object",
        additionalProperties: false,
        required: [
          "importanceScore",
          "breakingNewsScore",
          "contentType",
          "confidence",
        ],
        properties: {
          importanceScore: { type: "number", minimum: 0, maximum: 10 },
          breakingNewsScore: { type: "number", minimum: 0, maximum: 10 },
          contentType: {
            type: "string",
            enum: ["news", "analysis_candidate", "opinion_candidate"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      sourceAttribution: {
        type: "object",
        additionalProperties: false,
        required: ["sourceName", "sourceUrl", "publishedAt"],
        properties: {
          sourceName: { type: "string", minLength: 1 },
          sourceUrl: { type: "string", minLength: 1 },
          publishedAt: { type: ["string", "null"] },
        },
      },
      editorialNotes: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "keyFacts", "riskFlags", "humanReviewRequired"],
        properties: {
          summary: { type: "string", minLength: 1 },
          keyFacts: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          riskFlags: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          humanReviewRequired: { type: "boolean" },
        },
      },
    },
  };
}
