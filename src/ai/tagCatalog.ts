import {
  getAllowedTagSlugsForCategory,
  getTagCatalog,
  getTagsForCategory,
} from "../sanity/tagCache";

export interface AiTagCatalogItem {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  categorySlug: string;
  categoryTitle: string;
}

/**
 * Loads the current Sanity tag catalog from the local cache snapshot.
 * The Gunner startup refresh keeps this file current before writes.
 */
export function loadAiTagCatalog(category?: string): AiTagCatalogItem[] {
  const catalog = category ? getTagsForCategory(category) : getTagCatalog();
  return catalog.map((tag) => ({
    id: tag.id,
    slug: tag.slug,
    title: tag.title,
    categoryId: tag.categoryId,
    categorySlug: tag.categorySlug,
    categoryTitle: tag.categoryTitle,
  }));
}

export function getAllowedTagSlugsForAi(category: string): string[] {
  return getAllowedTagSlugsForCategory(category);
}
