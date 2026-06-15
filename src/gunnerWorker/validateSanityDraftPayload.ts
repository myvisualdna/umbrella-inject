import type { SanityDraftPost } from "./types";

export interface DraftValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Fields that must NEVER appear on a Gunner-created draft. Their presence is a
 * hard validation failure to guard against accidental publishing / legacy
 * pipeline leakage.
 */
const FORBIDDEN_FIELDS = [
  "publishedAt",
  "bodyTextOne",
  "date",
  "priority",
  "labels",
  "mainHeadlineRank",
  "frontlineRank",
  "rightHeadlineRank",
  "justInRank",
  "mainHeadlineUntil",
  "frontlineUntil",
  "rightHeadlineUntil",
  "justInUntil",
  "breakingNewsUntil",
];

const HOMEPAGE_FLAGS = [
  "mainHeadline",
  "frontline",
  "rightHeadline",
  "justIn",
  "breakingNews",
  "developingStory",
  "featured",
];

/**
 * Validates a mapped draft document before it is previewed or written.
 * Enforces the draft-only, no-publish, no-homepage contract.
 */
export function validateSanityDraftPayload(doc: unknown): DraftValidationResult {
  const issues: string[] = [];

  if (!doc || typeof doc !== "object") {
    return { valid: false, issues: ["Draft is not an object"] };
  }

  const record = doc as Record<string, unknown>;
  const draft = doc as SanityDraftPost;

  if (typeof draft._id !== "string" || !draft._id.startsWith("drafts.ingest-")) {
    issues.push(`_id must start with "drafts.ingest-" (got: ${String(draft._id)})`);
  }
  if (draft._type !== "post") {
    issues.push(`_type must be "post" (got: ${String(draft._type)})`);
  }
  if (draft.status !== "draft") {
    issues.push(`status must be "draft" (got: ${String(draft.status)})`);
  }

  if (typeof draft.title !== "string" || draft.title.trim().length < 4) {
    issues.push("title must be a string of at least 4 characters");
  }
  if (typeof draft.tickerTitle !== "string" || draft.tickerTitle.length === 0) {
    issues.push("tickerTitle is required");
  } else if (draft.tickerTitle.length > 40) {
    issues.push(`tickerTitle must be <= 40 chars (got: ${draft.tickerTitle.length})`);
  }
  if (draft.excerpt !== undefined && draft.excerpt.length > 280) {
    issues.push(`excerpt must be <= 280 chars (got: ${draft.excerpt.length})`);
  }

  if (!draft.slug || draft.slug._type !== "slug" || !draft.slug.current) {
    issues.push("slug is required and must have a non-empty current value");
  }

  if (
    !draft.category ||
    draft.category._type !== "reference" ||
    typeof draft.category._ref !== "string" ||
    draft.category._ref.length === 0
  ) {
    issues.push("category reference is required (could not be resolved)");
  }

  if (!Array.isArray(draft.body) || draft.body.length === 0) {
    issues.push("body must contain at least one Portable Text block");
  } else {
    const allBlocksValid = draft.body.every(
      (block) =>
        block &&
        block._type === "block" &&
        Array.isArray(block.children) &&
        block.children.some((span) => span._type === "span" && span.text.trim().length > 0)
    );
    if (!allBlocksValid) {
      issues.push("body contains invalid or empty blocks");
    }
  }

  if (!draft.seo || draft.seo._type !== "seo") {
    issues.push('seo must be present with _type "seo"');
  }

  if (!draft.cover || draft.cover._type !== "coverMedia") {
    issues.push('cover is required with _type "coverMedia"');
  } else {
    if (draft.cover.source !== "external") {
      issues.push(`cover.source must be "external" (got: ${String(draft.cover.source)})`);
    }
    if (!draft.cover.externalUrl || draft.cover.externalUrl.trim().length === 0) {
      issues.push("cover.externalUrl is required");
    }
    if (!draft.cover.alt || draft.cover.alt.trim().length === 0) {
      issues.push("cover.alt is required");
    }
    if (!draft.cover.caption || draft.cover.caption.trim().length === 0) {
      issues.push("cover.caption is required");
    }
    if (!draft.cover.creditAuthor || draft.cover.creditAuthor.trim().length === 0) {
      issues.push("cover.creditAuthor is required");
    }
    if (!draft.cover.creditSource || draft.cover.creditSource.trim().length === 0) {
      issues.push("cover.creditSource is required");
    }
    if (!draft.cover.licenseOrRights || draft.cover.licenseOrRights.trim().length === 0) {
      issues.push("cover.licenseOrRights is required");
    }
  }

  for (const field of FORBIDDEN_FIELDS) {
    if (record[field] !== undefined) {
      issues.push(`Forbidden field present: ${field}`);
    }
  }

  for (const flag of HOMEPAGE_FLAGS) {
    if (record[flag] !== undefined && record[flag] !== false) {
      issues.push(`Homepage/editorial flag "${flag}" must be false (got: ${String(record[flag])})`);
    }
  }

  return { valid: issues.length === 0, issues };
}
