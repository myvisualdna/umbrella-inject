/**
 * JSON Schema for ChatGPT Article Response
 * 
 * Validates the structure and constraints of ChatGPT's JSON output
 */

export const articleSchema = {
  type: "object",
  required: ["title", "tickerTitle", "excerpt", "body", "imageKeyword", "tags"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    tickerTitle: { type: "string", minLength: 1, maxLength: 45 },
    excerpt: { type: "string", minLength: 1, maxLength: 160 },
    body: { type: "string", minLength: 1 },
    imageKeyword: { type: "string", minLength: 1 },
    tags: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;
