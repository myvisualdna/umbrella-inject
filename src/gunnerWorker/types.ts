import type { StoryCandidateStatus } from "../db/storyCandidates";
import type { ProcessedArticlePayload } from "../ai/types";

/**
 * Portable Text span (inline text node).
 */
export interface PortableTextSpan {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

/**
 * Portable Text block (paragraph). Matches Angle `blockContent` block members.
 */
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal";
  children: PortableTextSpan[];
  markDefs: unknown[];
}

export interface SanityReference {
  _type: "reference";
  _ref: string;
  _key?: string;
}

/**
 * Cover media object matching the Angle `coverMedia` object schema.
 * Only the external-URL shape is produced by the Gunner Worker.
 */
export interface SanityCoverMedia {
  _type: "coverMedia";
  source: "external";
  externalUrl: string;
  alt?: string;
  caption?: string;
  creditAuthor?: string;
  creditSource?: string;
  licenseOrRights?: string;
}

export interface SanitySeo {
  _type: "seo";
  title?: string;
  description?: string;
}

export interface SanitySlug {
  _type: "slug";
  current: string;
}

/**
 * Draft `post` document produced by the Gunner Worker.
 *
 * Draft-only: `status` is always "draft", `_id` is always a `drafts.` id, and
 * publishing / homepage / editorial fields are never enabled.
 */
export interface SanityDraftPost {
  _id: string;
  _type: "post";
  status: "draft";

  title: string;
  tickerTitle: string;
  excerpt?: string;
  slug: SanitySlug;

  category: SanityReference;
  tags?: SanityReference[];
  author?: SanityReference;

  cover: SanityCoverMedia;
  body: PortableTextBlock[];
  seo: SanitySeo;

  readTime?: number;

  // Homepage rails / editorial flags are explicitly disabled.
  mainHeadline: false;
  frontline: false;
  rightHeadline: false;
  justIn: false;
  breakingNews: false;
  developingStory: false;
  featured: false;
}

/**
 * Row view of a `processed` story_candidate consumed by the Gunner Worker.
 */
export interface GunnerCandidate {
  id: string;
  source_key: string;
  source_url: string;
  status: StoryCandidateStatus;
  attempt_count: number;
  processed_payload: ProcessedArticlePayload | null;
  raw_payload: unknown;
  sanity_document_id: string | null;
}

export interface GunnerMappingResult {
  draft: SanityDraftPost;
  warnings: string[];
  missingTags: string[];
  coverIncluded: boolean;
}

export interface GunnerCandidateOutcome {
  candidateId: string;
  sourceKey: string;
  sourceUrl: string;
  sanityDocumentId: string | null;
  mapped: boolean;
  drafted: boolean;
  failed: boolean;
  skippedExisting: boolean;
  validationIssues: string[];
  warnings: string[];
  error: string | null;
}

export interface GunnerDraftPreviewEntry {
  candidateId: string;
  sourceKey: string;
  sourceUrl: string;
  valid: boolean;
  validationIssues: string[];
  warnings: string[];
  draft: SanityDraftPost;
}
