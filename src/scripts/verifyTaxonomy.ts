/**
 * Offline taxonomy verification (no network).
 */

import { getAllowedTagSlugsForAi } from "../ai/tagCatalog";
import { resolveReferences } from "../gunnerWorker/resolveReferences";
import { clearCategoryCache } from "../sanity/categoryCache";
import { clearTagCache } from "../sanity/tagCache";
import {
  CANONICAL_CATEGORIES,
  flattenCanonicalTags,
  validateCanonicalTaxonomy,
} from "../utils/data/canonical-taxonomy";
import {
  buildCategoryFixtureFromManifest,
  buildTagFixtureFromManifest,
} from "../utils/data/writeTaxonomyFixtures";
import * as fs from "fs";
import { getCategoryCachePath } from "../sanity/categoryCache";
import { getTagCachePath } from "../sanity/tagCache";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readFixtureFile<T>(filePath: string): T {
  assert(fs.existsSync(filePath), `Missing fixture file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function testManifestValidation(): void {
  validateCanonicalTaxonomy();
  assert(CANONICAL_CATEGORIES.length === 8, "Expected 8 canonical categories");
  assert(flattenCanonicalTags().length === 37, "Expected 37 canonical tags");
}

function testFixtureShape(): void {
  const categories = readFixtureFile<{ categories: Array<Record<string, unknown>> }>(
    getCategoryCachePath()
  );
  const tags = readFixtureFile<{ tags: Array<Record<string, unknown>> }>(getTagCachePath());

  assert(categories.categories.length === 8, "Expected 8 categories in fixture");
  assert(tags.tags.length === 37, "Expected 37 tags in fixture");

  const categorySlugs = new Set(CANONICAL_CATEGORIES.map((category) => category.slug));
  const tagSlugs = new Set<string>();

  for (const tag of tags.tags) {
    const slug = String(tag.slug ?? "");
    const category = tag.category as Record<string, unknown> | undefined;
    assert(slug.length > 0, "Fixture tag slug is required");
    assert(!tagSlugs.has(slug), `Duplicate fixture tag slug: ${slug}`);
    tagSlugs.add(slug);
    assert(Boolean(category?._id), `Tag ${slug} missing category._id`);
    assert(Boolean(category?.slug), `Tag ${slug} missing category.slug`);
    assert(Boolean(category?.title), `Tag ${slug} missing category.title`);
    assert(
      categorySlugs.has(String(category?.slug)),
      `Tag ${slug} references non-canonical category ${String(category?.slug)}`
    );
  }
}

function testFixtureMatchesManifest(): void {
  const manifestCategories = buildCategoryFixtureFromManifest().categories;
  const manifestTags = buildTagFixtureFromManifest().tags;
  const fixtureCategories = readFixtureFile<{ categories: typeof manifestCategories }>(
    getCategoryCachePath()
  ).categories;
  const fixtureTags = readFixtureFile<{ tags: typeof manifestTags }>(getTagCachePath()).tags;

  assert(
    JSON.stringify(fixtureCategories) === JSON.stringify(manifestCategories),
    "Category fixture does not match canonical manifest"
  );
  assert(
    JSON.stringify(fixtureTags) === JSON.stringify(manifestTags),
    "Tag fixture does not match canonical manifest"
  );
}

function testAiAndGunnerCaches(): void {
  clearCategoryCache();
  clearTagCache();

  const politicsTags = getAllowedTagSlugsForAi("politics");
  const businessTags = getAllowedTagSlugsForAi("business");

  assert(politicsTags.includes("white-house"), "Politics cache should include white-house");
  assert(!politicsTags.includes("markets"), "Politics cache must exclude markets");
  assert(businessTags.includes("markets") && businessTags.includes("economy"), "Business cache tags");
  assert(!businessTags.includes("white-house"), "Business cache must exclude white-house");

  const matching = resolveReferences("business", ["markets"]);
  assert(Boolean(matching.categoryRef?._ref), "Business/markets should resolve category");
  assert(matching.tagRefs.length === 1, "Business/markets should resolve one tag");
  assert(matching.mismatchedTags.length === 0, "Business/markets should have no mismatches");

  const mismatched = resolveReferences("business", ["white-house"]);
  assert(mismatched.tagRefs.length === 0, "Cross-category tag must not resolve");
  assert(
    mismatched.mismatchedTags.includes("white-house"),
    "Cross-category tag should be reported as mismatched"
  );
}

function main(): void {
  testManifestValidation();
  testFixtureShape();
  testFixtureMatchesManifest();
  testAiAndGunnerCaches();
  console.log("verifyTaxonomy: PASS");
}

try {
  main();
} catch (error) {
  console.error("verifyTaxonomy: FAIL");
  console.error(error);
  process.exit(1);
}
