/**
 * Post-processing helpers to enforce output limits
 * 
 * Trims fields that exceed character limits to prevent validation failures.
 * This ensures we don't lose otherwise good rewrites due to minor length issues.
 */

/**
 * Trims a string to a maximum length, preserving word boundaries when possible
 * 
 * @param input - String to trim
 * @param max - Maximum character length
 * @returns Trimmed string with ellipsis if truncated
 */
function trimToMaxChars(input: string, max: number): string {
  const s = (input ?? "").trim();
  if (s.length <= max) return s;

  // Reserve 1 char for ellipsis
  const slice = s.slice(0, Math.max(0, max - 1)).trimEnd();

  // Trim to last word boundary if possible (avoid cutting mid-word)
  const lastSpace = slice.lastIndexOf(" ");
  const safe = lastSpace > 20 ? slice.slice(0, lastSpace).trimEnd() : slice;

  return `${safe}…`;
}

/**
 * Enforces output limits on ChatGPT response object
 * 
 * - Trims title, tickerTitle, excerpt to their max lengths
 * - Ensures tags array has exactly 3 strings
 * - Ensures imageKeyword is a single keyword
 * 
 * @param obj - Parsed ChatGPT response object
 * @returns Object with enforced limits
 */
export function enforceOutputLimits(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  // Trim string fields to their max lengths
  if (typeof obj.title === "string") {
    obj.title = trimToMaxChars(obj.title, 160);
  }
  if (typeof obj.tickerTitle === "string") {
    obj.tickerTitle = trimToMaxChars(obj.tickerTitle, 45);
  }
  if (typeof obj.excerpt === "string") {
    obj.excerpt = trimToMaxChars(obj.excerpt, 160);
  }

  // Ensure tags are exactly 3 strings (defensive)
  if (Array.isArray(obj.tags)) {
    obj.tags = obj.tags
      .filter((t: any) => typeof t === "string" && t.trim())
      .slice(0, 3);
  }

  // Ensure imageKeyword is a single keyword (take first token)
  if (typeof obj.imageKeyword === "string") {
    obj.imageKeyword = obj.imageKeyword.trim().split(/\s+/)[0] || obj.imageKeyword.trim();
  }

  return obj;
}
