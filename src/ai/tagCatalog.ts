import { getTagCatalog } from "../gunner/tagCache";

export interface AiTagCatalogItem {
  id: string;
  slug: string;
  title: string;
}

/**
 * Loads the current Sanity tag catalog from the local cache snapshot.
 * The Gunner startup refresh keeps this file current before writes.
 */
export function loadAiTagCatalog(): AiTagCatalogItem[] {
  return getTagCatalog().map((tag) => ({
    id: tag.id,
    slug: tag.slug,
    title: tag.title,
  }));
}

export function getAllowedTagSlugsForAi(): string[] {
  return loadAiTagCatalog().map((tag) => tag.slug);
}

