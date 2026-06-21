import * as fs from "fs";
import * as path from "path";
import {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_TAGS,
  buildCategoryDocumentId,
  buildTagDocumentId,
  getCanonicalCategoryBySlug,
  validateCanonicalTaxonomy,
} from "./canonical-taxonomy";
import { getCategoryCachePath } from "../../sanity/categoryCache";
import { getTagCachePath } from "../../sanity/tagCache";

export interface WriteTaxonomyFixturesResult {
  categoriesPath: string;
  tagsPath: string;
  categoryCount: number;
  tagCount: number;
}

export function buildCategoryFixtureFromManifest(): {
  lastUpdated: string;
  categories: Array<{ _id: string; slug: string; name: string }>;
} {
  validateCanonicalTaxonomy();

  return {
    lastUpdated: new Date().toISOString(),
    categories: CANONICAL_CATEGORIES.map((category) => ({
      _id: buildCategoryDocumentId(category.slug),
      slug: category.slug,
      name: category.title,
    })),
  };
}

export function buildTagFixtureFromManifest(): {
  lastUpdated: string;
  tags: Array<{
    _id: string;
    slug: string;
    title: string;
    aliases: string[];
    category: { _id: string; slug: string; title: string };
  }>;
} {
  validateCanonicalTaxonomy();

  const tags = Object.entries(CANONICAL_CATEGORY_TAGS).flatMap(([categorySlug, categoryTags]) => {
    const category = getCanonicalCategoryBySlug(categorySlug);
    if (!category) {
      throw new Error(`Missing canonical category for slug: ${categorySlug}`);
    }

    return categoryTags.map((tag) => ({
      _id: buildTagDocumentId(categorySlug, tag.slug),
      slug: tag.slug,
      title: tag.title,
      aliases: tag.aliases,
      category: {
        _id: buildCategoryDocumentId(categorySlug),
        slug: category.slug,
        title: category.title,
      },
    }));
  });

  return {
    lastUpdated: new Date().toISOString(),
    tags,
  };
}

function writeJson(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export function writeFixturesFromManifest(): WriteTaxonomyFixturesResult {
  const categories = buildCategoryFixtureFromManifest();
  const tags = buildTagFixtureFromManifest();
  const categoriesPath = getCategoryCachePath();
  const tagsPath = getTagCachePath();

  writeJson(categoriesPath, categories);
  writeJson(tagsPath, tags);

  return {
    categoriesPath,
    tagsPath,
    categoryCount: categories.categories.length,
    tagCount: tags.tags.length,
  };
}
