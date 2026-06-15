import type { PortableTextBlock } from "./types";

/**
 * Converts an array of plain-text paragraphs into Sanity Portable Text blocks.
 *
 * - Empty / whitespace-only paragraphs are removed.
 * - Keys are stable and derived from index (`{prefix}-b{i}` / `{prefix}-s{i}`)
 *   so re-running the worker produces identical output for the same input.
 */
export function paragraphsToPortableText(
  paragraphs: string[],
  keyPrefix = "body"
): PortableTextBlock[] {
  if (!Array.isArray(paragraphs)) return [];

  const blocks: PortableTextBlock[] = [];

  for (const paragraph of paragraphs) {
    const text = typeof paragraph === "string" ? paragraph.trim() : "";
    if (text.length === 0) continue;

    const index = blocks.length;
    blocks.push({
      _type: "block",
      _key: `${keyPrefix}-b${index}`,
      style: "normal",
      children: [
        {
          _type: "span",
          _key: `${keyPrefix}-s${index}`,
          text,
          marks: [],
        },
      ],
      markDefs: [],
    });
  }

  return blocks;
}

/**
 * Counts words across the body paragraphs (used for read-time estimation).
 */
export function countBodyWords(paragraphs: string[]): number {
  if (!Array.isArray(paragraphs)) return 0;
  return paragraphs.reduce((total, paragraph) => {
    const words = String(paragraph ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return total + words.length;
  }, 0);
}
