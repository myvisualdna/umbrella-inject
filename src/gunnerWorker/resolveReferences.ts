import { resolveCategoryReference } from "../sanity/categoryCache";
import { resolveTagReferencesForCategory } from "../sanity/tagCache";
import type { SanityReference } from "./types";

export interface ResolvedReferences {
  categoryRef: SanityReference | null;
  tagRefs: SanityReference[];
  missingTags: string[];
  mismatchedTags: string[];
}

/**
 * Resolves the processed payload's category and tags to existing Sanity
 * references using the local read-only caches (no Sanity writes).
 *
 * - Category is required; returns null categoryRef when it cannot be resolved.
 * - Tags must belong to the resolved category.
 * - Unresolved tags are reported in `missingTags`.
 * - Tags from another category are reported in `mismatchedTags`.
 */
export function resolveReferences(
  category: string,
  tagSlugs: string[]
): ResolvedReferences {
  const legacyCategory = resolveCategoryReference(category);
  const categoryRef: SanityReference | null = legacyCategory
    ? { _type: "reference", _ref: legacyCategory._ref }
    : null;

  const { references, missingTags, mismatchedTags } = resolveTagReferencesForCategory(
    category,
    tagSlugs ?? []
  );

  return {
    categoryRef,
    tagRefs: references,
    missingTags,
    mismatchedTags,
  };
}
