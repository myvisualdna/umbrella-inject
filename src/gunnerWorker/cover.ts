import type { SanityCoverMedia } from "./types";

export interface PlaceholderCoverConfig {
  source: "external";
  externalUrl: string;
  alt: string;
  caption: string;
  creditAuthor: string;
  creditSource: string;
  licenseOrRights: string;
}

export interface PlaceholderCoverResult {
  cover: SanityCoverMedia;
  warnings: string[];
}

/** Supabase Storage: angle-media/angle-placeholders/theangle-cover-placeholder.png */
export const DEFAULT_PLACEHOLDER_COVER_URL =
  "https://zmpglszxzgwsnvwhsxiv.supabase.co/storage/v1/object/sign/angle-media/angle-placeholders/theangle-cover-placeholder.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zM2U0NjY2ZC1hNjk5LTRmYzEtYjE3ZC1hODgzMjA4MzlmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmdsZS1tZWRpYS9hbmdsZS1wbGFjZWhvbGRlcnMvdGhlYW5nbGUtY292ZXItcGxhY2Vob2xkZXIucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MTQ3MTU3NywiZXhwIjoyMDk2ODMxNTc3fQ.haUmVJtIcwggr4LEn7YlufatpmhMoL52oNd4nSUc_Wo";

export const DEFAULT_PLACEHOLDER_COVER_ALT =
  "The Angle: News, analysis and perspective.";
export const DEFAULT_PLACEHOLDER_COVER_CAPTION =
  "The Angle: News, analysis and perspective.";
export const DEFAULT_PLACEHOLDER_COVER_CREDIT_AUTHOR = "Angle";
export const DEFAULT_PLACEHOLDER_COVER_CREDIT_SOURCE = "Angle";
export const DEFAULT_PLACEHOLDER_COVER_LICENSE_OR_RIGHTS = "The Angle Media Network.";

export function parsePlaceholderCoverConfig(
  env: NodeJS.ProcessEnv = process.env
): PlaceholderCoverConfig {
  const sourceRaw = env.GUNNER_PLACEHOLDER_COVER_SOURCE?.trim() || "external";
  const source: "external" = sourceRaw === "external" ? "external" : "external";

  return {
    source,
    externalUrl:
      env.GUNNER_PLACEHOLDER_COVER_URL?.trim() || DEFAULT_PLACEHOLDER_COVER_URL,
    alt: env.GUNNER_PLACEHOLDER_COVER_ALT?.trim() || DEFAULT_PLACEHOLDER_COVER_ALT,
    caption:
      env.GUNNER_PLACEHOLDER_COVER_CAPTION?.trim() ||
      DEFAULT_PLACEHOLDER_COVER_CAPTION,
    creditAuthor:
      env.GUNNER_PLACEHOLDER_COVER_CREDIT_AUTHOR?.trim() ||
      DEFAULT_PLACEHOLDER_COVER_CREDIT_AUTHOR,
    creditSource:
      env.GUNNER_PLACEHOLDER_COVER_CREDIT_SOURCE?.trim() ||
      DEFAULT_PLACEHOLDER_COVER_CREDIT_SOURCE,
    licenseOrRights:
      env.GUNNER_PLACEHOLDER_COVER_LICENSE_OR_RIGHTS?.trim() ||
      DEFAULT_PLACEHOLDER_COVER_LICENSE_OR_RIGHTS,
  };
}

/**
 * Builds a schema-valid placeholder cover for draft generation.
 * The editor is expected to review/replace this in Sanity Studio before publish.
 */
export function buildPlaceholderCover(
  config: PlaceholderCoverConfig
): PlaceholderCoverResult {
  const cover: SanityCoverMedia = {
    _type: "coverMedia",
    source: "external",
    externalUrl: config.externalUrl,
    alt: config.alt,
    caption: config.caption,
    creditAuthor: config.creditAuthor,
    creditSource: config.creditSource,
    licenseOrRights: config.licenseOrRights,
  };

  return {
    cover,
    warnings: [
      "placeholder_cover_used_replace_before_publish",
      "editor_must_review_image_before_publish",
    ],
  };
}
