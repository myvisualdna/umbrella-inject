import type { WorkerStoryCandidate } from "./types";

/** Max characters of source body sent to the model, to bound prompt size. */
export const MAX_SOURCE_BODY_CHARS = 8000;

export function truncateBody(body: string, maxChars = MAX_SOURCE_BODY_CHARS): string {
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[truncated]`;
}

export function buildSystemPrompt(allowedTagSlugs: string[]): string {
  const allowedTagsLine =
    allowedTagSlugs.length > 0
      ? `- Allowed tag slugs: ${allowedTagSlugs.join(", ")}.`
      : "- Allowed tag slugs list is empty. Return `tagSlugs: []`.";

  return [
    "You are an editorial assistant for a neutral news publication.",
    "Rewrite the provided source article into a structured draft.",
    "Rules:",
    "- Keep all facts, names, dates, and quotes accurate. Do not invent information.",
    "- Use a neutral, professional news tone with original wording and structure.",
    "- `body` MUST be an array of plain-text paragraphs (no Markdown, no HTML, no Portable Text).",
    "- `sourceAttribution.sourceUrl` MUST exactly equal the provided source URL.",
    "- `editorialNotes.humanReviewRequired` MUST be true.",
    "- Return `tagSlugs` only (slug values), never free-text tags.",
    "- You must choose tags only from the allowed slug list.",
    "- Do not invent new tags. If none are relevant, return `tagSlugs: []`.",
    allowedTagsLine,
    "- Respect all field length and range constraints in the provided schema.",
    "Return only the structured JSON object defined by the response schema.",
  ].join("\n");
}

export function buildUserPrompt(candidate: WorkerStoryCandidate): string {
  return [
    `Source name: ${candidate.source_name}`,
    `Source URL: ${candidate.source_url}`,
    `Category: ${candidate.category}`,
    `Published at: ${candidate.published_at ?? "unknown"}`,
    `Title: ${candidate.title}`,
    candidate.excerpt ? `Excerpt: ${candidate.excerpt}` : "",
    "",
    "Body:",
    truncateBody(candidate.body),
  ]
    .filter((line) => line !== "")
    .join("\n");
}
