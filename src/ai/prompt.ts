import type { WorkerStoryCandidate } from "./types";

/** Max characters of source body sent to the model, to bound prompt size. */
export const MAX_SOURCE_BODY_CHARS = 6000;

export function truncateBody(body: string, maxChars = MAX_SOURCE_BODY_CHARS): string {
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[truncated]`;
}

export function buildSystemPrompt(allowedTagSlugs: string[]): string {
  const allowedTagsLine =
    allowedTagSlugs.length > 0
      ? `- Allowed tag slugs: ${allowedTagSlugs.join(", ")}.`
      : "- Allowed tag slugs: none. Use tagSlugs: [].";

  return [
    "You are an editorial assistant for a neutral news publication.",
    "Rewrite the source article into a structured news draft.",
    "Rules:",
    "- Preserve facts, names, dates, quotes, and source meaning. Do not invent information.",
    "- Use neutral news tone with original wording.",
    "- tickerTitle: max 40 characters; compact, punchy, keyword-rich; lead with the main actor/event.",
    "- body must be plain-text paragraphs only (no Markdown, HTML, or Portable Text).",
    "- sourceAttribution.sourceUrl must exactly match the input url.",
    "- editorialNotes.humanReviewRequired must be true.",
    "- tagSlugs must use allowed slugs only, or [] if none apply.",
    allowedTagsLine,
  ].join("\n");
}

export function buildUserPrompt(candidate: WorkerStoryCandidate): string {
  return [
    `source: ${candidate.source_name}`,
    `url: ${candidate.source_url}`,
    `category: ${candidate.category}`,
    `publishedAt: ${candidate.published_at ?? "unknown"}`,
    `title: ${candidate.title}`,
    candidate.excerpt ? `excerpt: ${candidate.excerpt}` : "",
    "body:",
    truncateBody(candidate.body),
  ]
    .filter((line) => line !== "")
    .join("\n");
}
