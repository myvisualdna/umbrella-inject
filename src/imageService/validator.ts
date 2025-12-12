/**
 * JSON Schema Validator for ChatGPT Responses
 */

import Ajv from "ajv";
import { articleSchema } from "./chatgptSchema";
import { logger } from "../config/logger";

const ajv = new Ajv({ allErrors: true });
const validateArticle = ajv.compile(articleSchema);

/**
 * Validates ChatGPT JSON output against the article schema
 * 
 * @param json - The parsed JSON object to validate
 * @returns true if valid, false otherwise
 */
export function validateChatGPTOutput(json: unknown): boolean {
  const valid = validateArticle(json);

  if (!valid) {
    logger.error("Invalid ChatGPT JSON response", {
      errors: validateArticle.errors,
      json: JSON.stringify(json, null, 2),
    });
    
    // Log validation errors to console for debugging
    if (validateArticle.errors && validateArticle.errors.length > 0) {
      console.log("❌ ChatGPT response validation failed:");
      validateArticle.errors.forEach((error) => {
        const path = error.instancePath || error.params?.missingProperty || "root";
        console.log(`   - ${path}: ${error.message}`);
      });
      console.log("");
    }
  }

  return !!valid;
}
