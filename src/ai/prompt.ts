import type { WorkerStoryCandidate } from "./types";

/** Max characters of source body sent to the model, to bound prompt size. */
export const MAX_SOURCE_BODY_CHARS = 6000;

export type EditorialTonePreset =
  | "angle_default"
  | "wire_direct"
  | "explainer_context"
  | "political_insider"
  | "business_brief";

const CATEGORY_TONE_PRESETS: Record<string, EditorialTonePreset> = {
  us: "wire_direct",
  world: "wire_direct",
  politics: "political_insider",
  business: "business_brief",
  science: "explainer_context",
  tech: "explainer_context",
  entertainment: "angle_default",
  lifestyle: "angle_default",
};

const TONE_PRESET_TEXT: Record<EditorialTonePreset, string[]> = {
  angle_default: [
    "Use a clear, concise, modern US news voice.",
    "Lead with the main development and why it matters.",
    "Use short paragraphs, usually 1-3 sentences.",
    "Stay neutral; avoid hype, loaded adjectives, opinion, and clickbait.",
    "Prefer active voice when accurate.",
  ],
  wire_direct: [
    "Prioritize verified facts, chronology, attribution, and clarity.",
    "Lead with what happened, where, and who is affected.",
    "Keep context brief and analysis minimal.",
    "Use compact sentences and straightforward structure.",
    "Avoid flourish, speculation, and commentary.",
  ],
  explainer_context: [
    "Lead with the news, then explain why it matters.",
    "Add concise background only when supported by the source.",
    "Make complex developments easy to follow in plain language.",
    "Explain causes, stakes, or next steps only when grounded in the source.",
    "Avoid jargon and unsupported interpretation.",
  ],
  political_insider: [
    "Focus on power, institutions, policy, campaigns, and consequences.",
    "Explain the political stakes clearly without exaggeration.",
    "Be sharp but neutral.",
    "Avoid horse-race framing unless directly supported by the source.",
    "Preserve attribution for claims, criticism, and disputed statements.",
  ],
  business_brief: [
    "Focus on companies, markets, money, strategy, jobs, and consumer impact.",
    "Explain financial or business consequences in plain language.",
    "Use numbers carefully and preserve attribution.",
    "Keep the tone accessible, not corporate.",
    "Avoid market hype, startup hype, and executive praise.",
  ],
};

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function truncateBody(body: string, maxChars = MAX_SOURCE_BODY_CHARS): string {
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[truncated]`;
}

export function buildTonePreset(preset: EditorialTonePreset): string {
  return TONE_PRESET_TEXT[preset].map((line) => `- ${line}`).join("\n");
}

export function resolveEditorialTonePreset(
  candidate: WorkerStoryCandidate
): EditorialTonePreset {
  return CATEGORY_TONE_PRESETS[normalizeCategory(candidate.category)] ?? "angle_default";
}

/**
 * Low-level system prompt builder for a known preset.
 * Runtime/provider code should prefer `buildSystemPromptForCandidate()` so
 * category-based editorial tone is always resolved in app code.
 */
export function buildSystemPrompt(
  allowedTagSlugs: string[],
  preset: EditorialTonePreset = "angle_default"
): string {
  const allowedTagsLine =
    allowedTagSlugs.length > 0
      ? `- Allowed tag slugs: ${allowedTagSlugs.join(", ")}.`
      : "- Allowed tag slugs: none. Use tagSlugs: [].";

  return [
    "You are an editorial assistant for Angle, a neutral US news publication.",
    "Rewrite the source article into a structured news draft.",
    `Editorial tone: ${preset}.`,
    buildTonePreset(preset),
    "Rules:",
    "- Preserve facts, names, dates, quotes, and source meaning. Do not invent information.",
    "- Use fresh wording and structure; do not closely paraphrase.",
    "- tickerTitle: max 40 characters; compact, punchy, keyword-rich; lead with the main actor/event.",
    "- body must be plain-text paragraphs only (no Markdown, HTML, or Portable Text).",
    "- sourceAttribution.sourceUrl must exactly match the input url.",
    "- editorialNotes.humanReviewRequired must be true.",
    "- tagSlugs must use allowed slugs only, or [] if none apply.",
    allowedTagsLine,
    "Return only the structured JSON object.",
  ].join("\n");
}

/** Preferred runtime API: resolves editorial tone from candidate.category. */
export function buildSystemPromptForCandidate(
  candidate: WorkerStoryCandidate,
  allowedTagSlugs: string[]
): string {
  const preset = resolveEditorialTonePreset(candidate);
  return buildSystemPrompt(allowedTagSlugs, preset);
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
