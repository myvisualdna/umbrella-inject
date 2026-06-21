import {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_TAGS,
  buildCategoryDocumentId,
  buildTagDocumentId,
  flattenCanonicalTags,
} from "./canonical-taxonomy";

export interface ExistingCategory {
  _id: string;
  slug?: string;
  name?: string;
}

export interface ExistingTag {
  _id: string;
  slug?: string;
  title?: string;
  categoryId?: string;
  categorySlug?: string;
}

export interface TaxonomyClient {
  fetch<T>(query: string, params?: Record<string, unknown>): Promise<T>;
  createOrReplace(doc: Record<string, unknown>): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export function buildCategoryDocuments() {
  return CANONICAL_CATEGORIES.map((category, index) => ({
    _id: buildCategoryDocumentId(category.slug),
    _type: "category" as const,
    name: category.title,
    slug: { _type: "slug" as const, current: category.slug },
    featured: false,
    hidden: false,
    order: index,
    views: 0,
  }));
}

export function buildTagDocuments() {
  return flattenCanonicalTags().map((tag, index) => ({
    _id: buildTagDocumentId(tag.categorySlug, tag.slug),
    _type: "tag" as const,
    title: tag.title,
    slug: { _type: "slug" as const, current: tag.slug },
    aliases: tag.aliases,
    category: {
      _type: "reference" as const,
      _ref: buildCategoryDocumentId(tag.categorySlug),
    },
    featured: false,
    hidden: false,
    deprecated: false,
    order: index,
    views: 0,
  }));
}

export async function fetchExistingTaxonomy(client: TaxonomyClient) {
  const categories = await client.fetch<ExistingCategory[]>(
    `*[_type == "category"]{ _id, "slug": slug.current, name }`
  );
  const tags = await client.fetch<ExistingTag[]>(
    `*[_type == "tag"]{
      _id,
      "slug": slug.current,
      title,
      "categoryId": category._ref,
      "categorySlug": category->slug.current
    }`
  );
  return { categories: categories ?? [], tags: tags ?? [] };
}

export async function fetchReferencedTaxonomyIds(
  client: TaxonomyClient
): Promise<{ categoryIds: Set<string>; tagIds: Set<string> }> {
  const articleTypes = ["post", "analysis", "sponsored"];
  const referencedCategories = await client.fetch<Array<{ ref: string }>>(
    `*[_type in $types && defined(category._ref)]{ "ref": category._ref }`,
    { types: articleTypes }
  );
  const referencedTags = await client.fetch<Array<{ refs: string[] }>>(
    `*[_type in $types && count(tags[]) > 0]{
      "refs": tags[]._ref
    }`,
    { types: articleTypes }
  );

  const categoryIds = new Set<string>();
  for (const row of referencedCategories ?? []) {
    if (row.ref) categoryIds.add(row.ref);
  }

  const tagIds = new Set<string>();
  for (const row of referencedTags ?? []) {
    for (const ref of row.refs ?? []) {
      if (ref) tagIds.add(ref);
    }
  }

  return { categoryIds, tagIds };
}

export function findObsoleteCategories(
  existing: ExistingCategory[],
  canonicalCategoryIds: Set<string>,
  canonicalCategorySlugs: Set<string>
): ExistingCategory[] {
  return existing.filter((category) => {
    const slug = category.slug?.toLowerCase();
    if (slug && canonicalCategorySlugs.has(slug) && canonicalCategoryIds.has(category._id)) {
      return false;
    }
    return !canonicalCategoryIds.has(category._id);
  });
}

export function findObsoleteTags(
  existing: ExistingTag[],
  canonicalTagIds: Set<string>,
  canonicalTagSlugs: Set<string>
): ExistingTag[] {
  return existing.filter((tag) => {
    const slug = tag.slug?.toLowerCase();
    if (slug && canonicalTagSlugs.has(slug) && canonicalTagIds.has(tag._id)) {
      return false;
    }
    return !canonicalTagIds.has(tag._id);
  });
}

export function printPlannedTaxonomyUpserts(): void {
  console.log("\nCategories to upsert:");
  for (const category of buildCategoryDocuments()) {
    console.log(`  - ${category._id} | ${category.name} (${category.slug.current})`);
  }

  console.log("\nTags to upsert (grouped by category):");
  for (const category of CANONICAL_CATEGORIES) {
    const tags = CANONICAL_CATEGORY_TAGS[category.slug] ?? [];
    console.log(`\n  ${category.title} (${category.slug})`);
    for (const tag of tags) {
      console.log(
        `    - ${buildTagDocumentId(category.slug, tag.slug)} | ${tag.title} (${tag.slug})`
      );
    }
  }
}

export async function upsertCanonicalTaxonomy(client: TaxonomyClient): Promise<void> {
  const categories = buildCategoryDocuments();
  const tags = buildTagDocuments();

  console.log(`\nUpserting ${categories.length} categories...`);
  for (const category of categories) {
    await client.createOrReplace(category);
    console.log(`  upserted ${category._id}`);
  }

  console.log(`\nUpserting ${tags.length} tags...`);
  for (const tag of tags) {
    await client.createOrReplace(tag);
    console.log(`  upserted ${tag._id}`);
  }
}

export async function deleteObsoleteTaxonomy(client: TaxonomyClient): Promise<void> {
  const existing = await fetchExistingTaxonomy(client);
  const canonicalCategoryIds = new Set(buildCategoryDocuments().map((doc) => doc._id));
  const canonicalCategorySlugs = new Set(CANONICAL_CATEGORIES.map((doc) => doc.slug));
  const canonicalTagIds = new Set(buildTagDocuments().map((doc) => doc._id));
  const canonicalTagSlugs = new Set(flattenCanonicalTags().map((tag) => tag.slug));

  const obsoleteCategories = findObsoleteCategories(
    existing.categories,
    canonicalCategoryIds,
    canonicalCategorySlugs
  );
  const obsoleteTags = findObsoleteTags(existing.tags, canonicalTagIds, canonicalTagSlugs);

  console.log("\nDeleting obsolete tags...");
  for (const tag of obsoleteTags) {
    try {
      await client.delete(tag._id);
      console.log(`  deleted tag ${tag._id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  skipped tag ${tag._id}: ${message}`);
    }
  }

  console.log("\nDeleting obsolete categories...");
  for (const category of obsoleteCategories) {
    try {
      await client.delete(category._id);
      console.log(`  deleted category ${category._id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  skipped category ${category._id}: ${message}`);
    }
  }
}

export function summarizeTaxonomyDiff(
  existing: { categories: ExistingCategory[]; tags: ExistingTag[] },
  references: { categoryIds: Set<string>; tagIds: Set<string> }
): {
  obsoleteCategories: ExistingCategory[];
  obsoleteTags: ExistingTag[];
} {
  const canonicalCategoryIds = new Set(buildCategoryDocuments().map((doc) => doc._id));
  const canonicalCategorySlugs = new Set(CANONICAL_CATEGORIES.map((doc) => doc.slug));
  const canonicalTagIds = new Set(buildTagDocuments().map((doc) => doc._id));
  const canonicalTagSlugs = new Set(flattenCanonicalTags().map((tag) => tag.slug));

  const obsoleteCategories = findObsoleteCategories(
    existing.categories,
    canonicalCategoryIds,
    canonicalCategorySlugs
  );
  const obsoleteTags = findObsoleteTags(existing.tags, canonicalTagIds, canonicalTagSlugs);

  console.log("\nExisting taxonomy in Sanity:");
  console.log(`  Categories: ${existing.categories.length}`);
  console.log(`  Tags: ${existing.tags.length}`);

  console.log("\nObsolete categories that would be deleted:");
  if (obsoleteCategories.length === 0) {
    console.log("  (none)");
  } else {
    for (const category of obsoleteCategories) {
      const referenced = references.categoryIds.has(category._id)
        ? " [referenced by articles]"
        : "";
      console.log(
        `  - ${category._id} | ${category.name ?? "Unnamed"} (${category.slug ?? "no-slug"})${referenced}`
      );
    }
  }

  console.log("\nObsolete tags that would be deleted:");
  if (obsoleteTags.length === 0) {
    console.log("  (none)");
  } else {
    for (const tag of obsoleteTags) {
      const referenced = references.tagIds.has(tag._id) ? " [referenced by articles]" : "";
      console.log(
        `  - ${tag._id} | ${tag.title ?? "Untitled"} (${tag.slug ?? "no-slug"}) -> ${tag.categorySlug ?? "no-category"}${referenced}`
      );
    }
  }

  return { obsoleteCategories, obsoleteTags };
}
