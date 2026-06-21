/**
 * Offline verification for canonical seed articles manifest.
 */

import { CANONICAL_CATEGORIES } from "../utils/data/canonical-taxonomy";
import { CANONICAL_SEED_ARTICLES } from "../utils/data/canonical-articles";
import { summarizeSeedArticleDates } from "../utils/data/buildSeedArticleDocuments";
import {
  assertHomepageTagCoverage,
  validateCanonicalArticles,
} from "../utils/data/validateCanonicalArticles";
import { buildSeedArticleDocument } from "../utils/data/buildSeedArticleDocuments";

const FIXED_NOW = new Date("2026-06-20T12:00:00.000Z");

function main(): void {
  console.log("=".repeat(72));
  console.log("Canonical Articles Verify (offline)");
  console.log("=".repeat(72));

  const summary = validateCanonicalArticles(CANONICAL_SEED_ARTICLES, FIXED_NOW);
  assertHomepageTagCoverage(CANONICAL_SEED_ARTICLES);

  const categoryScoped = CANONICAL_SEED_ARTICLES.filter(
    (article) => article.articleType !== "opinion"
  );
  if (categoryScoped.length < 32) {
    throw new Error(`Expected >=32 category-scoped articles, found ${categoryScoped.length}`);
  }

  for (const category of CANONICAL_CATEGORIES) {
    const count = categoryScoped.filter((article) => article.categorySlug === category.slug).length;
    if (count === 0) {
      throw new Error(`Category ${category.slug} has no seed articles`);
    }
  }

  const dateRange = summarizeSeedArticleDates(CANONICAL_SEED_ARTICLES, FIXED_NOW);
  const earliest = new Date(dateRange.earliest);
  const latest = new Date(dateRange.latest);
  const maxAgeMs = 14 * 24 * 60 * 60 * 1000;

  if (latest.getTime() > FIXED_NOW.getTime()) {
    throw new Error("Latest seed publication date is in the future");
  }
  if (FIXED_NOW.getTime() - earliest.getTime() > maxAgeMs + 60_000) {
    throw new Error("Earliest seed publication date is older than 14 days");
  }

  const sampleDoc = buildSeedArticleDocument(CANONICAL_SEED_ARTICLES[0], FIXED_NOW);
  const cover = sampleDoc.cover as { _type?: string; source?: string; externalUrl?: string };
  if (cover?._type !== "coverMedia" || cover?.source !== "external" || !cover?.externalUrl) {
    throw new Error("Seed article cover must be a coverMedia object with externalUrl");
  }
  if ("warnings" in (sampleDoc.cover as object)) {
    throw new Error("Seed article cover must not wrap PlaceholderCoverResult");
  }

  console.log(`Total seed articles: ${summary.total}`);
  console.log(`  post: ${summary.byType.post}`);
  console.log(`  analysis: ${summary.byType.analysis}`);
  console.log(`  opinion: ${summary.byType.opinion}`);
  console.log(`Category-scoped articles: ${categoryScoped.length}`);
  console.log(`Publication range (fixed now): ${dateRange.earliest} -> ${dateRange.latest}`);
  console.log("Homepage tag coverage: congress, white-house, artificial-intelligence, china");
  console.log("\narticles:verify passed");
}

main();
