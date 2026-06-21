import type { ProcessedArticlePayload } from "../ai/types";
import { buildPlaceholderCover, type PlaceholderCoverConfig } from "./cover";
import { countBodyWords, paragraphsToPortableText } from "./portableText";
import { resolveReferences } from "./resolveReferences";
import { generateSlug } from "./slug";
import type { GunnerMappingResult, SanityDraftPost } from "./types";

const WORDS_PER_MINUTE = 200;

export interface MapOptions {
  /** Optional default author reference id (only set when provided). */
  defaultAuthorId?: string | null;
  placeholderCover: PlaceholderCoverConfig;
}

/**
 * Builds the deterministic draft document `_id` for a candidate.
 * Always a `drafts.` id so the document can never be published by this worker.
 */
export function buildDraftId(candidateId: string): string {
  return `drafts.ingest-${candidateId}`;
}

/**
 * Maps a validated ProcessedArticlePayload into an Angle Sanity `post` draft.
 *
 * Guarantees:
 * - `status` is always "draft"; `_id` is always a `drafts.` id.
 * - Body is Portable Text under `body` (never `bodyTextOne`).
 * - Homepage / editorial flags are always `false`.
 * - Never sets `publishedAt`, `date`, ranks, `*Until`, `priority`, or `labels`.
 */
export function mapProcessedPayloadToSanityDraft(
  candidateId: string,
  payload: ProcessedArticlePayload,
  _rawPayload: unknown,
  options: MapOptions
): GunnerMappingResult {
  const warnings: string[] = [];
  const validationIssues: string[] = [];
  const selectedTagSlugs = Array.isArray(payload.tagSlugs) ? payload.tagSlugs : [];

  const { categoryRef, tagRefs, missingTags, mismatchedTags } = resolveReferences(
    payload.category,
    selectedTagSlugs
  );

  if (!categoryRef) {
    validationIssues.push(
      `Category "${payload.category}" could not be resolved to a Sanity reference`
    );
  }
  if (missingTags.length > 0) {
    validationIssues.push(`Tag slugs not found in cache: ${missingTags.join(", ")}`);
  }
  if (mismatchedTags.length > 0) {
    validationIssues.push(
      `Tag slugs do not belong to category "${payload.category}": ${mismatchedTags.join(", ")}`
    );
  }

  const body = paragraphsToPortableText(payload.body ?? [], "body");
  const wordCount = countBodyWords(payload.body ?? []);
  const readTime = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  const placeholderCoverResult = buildPlaceholderCover(options.placeholderCover);
  warnings.push(...placeholderCoverResult.warnings);

  const draft: SanityDraftPost = {
    _id: buildDraftId(candidateId),
    _type: "post",
    status: "draft",

    title: payload.title,
    tickerTitle: payload.tickerTitle,
    excerpt: payload.excerpt,
    slug: { _type: "slug", current: generateSlug(payload.title) },

    // categoryRef may be null here; validator will reject. Cast keeps the
    // preview shape intact so the failure is visible in artifacts.
    category: categoryRef as SanityDraftPost["category"],

    cover: placeholderCoverResult.cover,
    body,
    seo: {
      _type: "seo",
      title: payload.seo?.title,
      description: payload.seo?.description,
    },

    readTime,

    mainHeadline: false,
    frontline: false,
    rightHeadline: false,
    justIn: false,
    breakingNews: false,
    developingStory: false,
    featured: false,
  };

  if (tagRefs.length > 0) {
    draft.tags = tagRefs;
  }

  if (options.defaultAuthorId && options.defaultAuthorId.trim().length > 0) {
    draft.author = { _type: "reference", _ref: options.defaultAuthorId.trim() };
    warnings.push("placeholder_author_used_review_before_publish");
  } else {
    warnings.push("default_author_not_configured_review_before_publish");
  }

  return {
    draft,
    warnings,
    missingTags,
    mismatchedTags,
    validationIssues,
    coverIncluded: true,
  };
}
