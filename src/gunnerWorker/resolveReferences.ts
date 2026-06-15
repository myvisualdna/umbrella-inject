import { resolveCategoryReference } from "../gunner/categoryCache";
import { resolveTagReference } from "../gunner/tagCache";
import type { SanityReference } from "./types";

export interface ResolvedReferences {
  categoryRef: SanityReference | null;
  tagRefs: SanityReference[];
  missingTags: string[];
}

/**
 * Resolves the processed payload's category and tags to existing Sanity
 * references using the local read-only caches (no Sanity writes).
 *
 * - Category is required; returns null categoryRef when it cannot be resolved.
 * - Tags are optional; unresolved tags are reported in `missingTags`.
 */
export function resolveReferences(
  category: string,
  tagSlugs: string[]
): ResolvedReferences {
  const legacyCategory = resolveCategoryReference(category);
  const categoryRef: SanityReference | null = legacyCategory
    ? { _type: "reference", _ref: legacyCategory._ref }
    : null;

  const tagRefs: SanityReference[] = [];
  const missingTags: string[] = [];
  const seenRefs = new Set<string>();

  for (let i = 0; i < (tagSlugs ?? []).length; i++) {
    const tag = tagSlugs[i];
    const resolved = resolveTagReference(tag);
    if (!resolved) {
      if (tag && tag.trim().length > 0) missingTags.push(tag);
      continue;
    }
    if (seenRefs.has(resolved._ref)) continue;
    seenRefs.add(resolved._ref);
    tagRefs.push({
      _type: "reference",
      _ref: resolved._ref,
      _key: `tag-${resolved._ref.substring(0, 8)}`,
    });
  }

  return { categoryRef, tagRefs, missingTags };
}
