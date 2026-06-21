/**
 * Reseed canonical seed articles into Sanity.
 *
 * Default: dry-run only (no Sanity writes).
 * Live write requires CONFIRM_SANITY_ARTICLE_RESEED=YES and --write.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSanityClient } from "../sanity/client";
import { CANONICAL_CATEGORIES } from "../utils/data/canonical-taxonomy";
import { CANONICAL_SEED_ARTICLES } from "../utils/data/canonical-articles";
import {
  buildSeedArticleDocuments,
  summarizeSeedArticleDates,
} from "../utils/data/buildSeedArticleDocuments";
import {
  assertHomepageTagCoverage,
  validateCanonicalArticles,
} from "../utils/data/validateCanonicalArticles";

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath, override: false });

const CONFIRM_ENV = "CONFIRM_SANITY_ARTICLE_RESEED";

function parseArgs(argv: string[]): { dryRun: boolean; write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run") || !write;
  return { dryRun, write };
}

function assertWriteConfirmation(): void {
  if (process.env[CONFIRM_ENV] !== "YES") {
    throw new Error(
      `Live article reseed requires ${CONFIRM_ENV}=YES environment variable`
    );
  }
}

function printHeader(mode: string): void {
  console.log("=".repeat(72));
  console.log("Canonical Article Reseed");
  console.log(`Mode: ${mode}`);
  console.log("=".repeat(72));
}

function printArticlePlan(summary: ReturnType<typeof validateCanonicalArticles>): void {
  console.log(`\nArticles to create: ${summary.total}`);
  console.log(`  post: ${summary.byType.post}`);
  console.log(`  analysis: ${summary.byType.analysis}`);
  console.log(`  opinion: ${summary.byType.opinion}`);

  console.log("\nBy category (category-scoped only):");
  for (const category of CANONICAL_CATEGORIES) {
    console.log(`  ${category.slug}: ${summary.byCategory[category.slug] ?? 0}`);
  }

  console.log("\nTag usage:");
  const tagEntries = Object.entries(summary.tagUsage).sort(([a], [b]) => a.localeCompare(b));
  for (const [tagSlug, count] of tagEntries) {
    console.log(`  ${tagSlug}: ${count}`);
  }

  console.log("\nGrouped articles:");
  for (const category of CANONICAL_CATEGORIES) {
    const categoryArticles = CANONICAL_SEED_ARTICLES.filter(
      (article) => article.categorySlug === category.slug
    );
    if (categoryArticles.length === 0) continue;
    console.log(`\n  ${category.title} (${category.slug})`);
    for (const article of categoryArticles) {
      const tags = article.tagSlugs?.join(", ") ?? "";
      console.log(`    - ${article.id} | ${article.articleType} | ${article.title}`);
      if (tags) console.log(`      tags: ${tags}`);
    }
  }

  const opinions = CANONICAL_SEED_ARTICLES.filter((article) => article.articleType === "opinion");
  if (opinions.length > 0) {
    console.log("\n  Opinion (global)");
    for (const article of opinions) {
      console.log(`    - ${article.id} | ${article.title}`);
    }
  }
}

export async function runArticlesDryRun(now: Date = new Date()): Promise<void> {
  validateCanonicalArticles(CANONICAL_SEED_ARTICLES, now);
  assertHomepageTagCoverage(CANONICAL_SEED_ARTICLES);

  printHeader("DRY-RUN (no Sanity writes)");
  const summary = validateCanonicalArticles(CANONICAL_SEED_ARTICLES, now);
  printArticlePlan(summary);

  const dateRange = summarizeSeedArticleDates(CANONICAL_SEED_ARTICLES, now);
  console.log(`\nComputed publication date range:`);
  console.log(`  earliest: ${dateRange.earliest}`);
  console.log(`  latest:   ${dateRange.latest}`);

  console.log("\nValidation: passed");
  console.log("\nDry-run complete. No changes were written.");
}

export async function runArticlesWrite(now: Date = new Date()): Promise<void> {
  assertWriteConfirmation();
  validateCanonicalArticles(CANONICAL_SEED_ARTICLES, now);
  assertHomepageTagCoverage(CANONICAL_SEED_ARTICLES);

  printHeader("WRITE (Sanity mutations enabled)");

  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client is unavailable. Check SANITY credentials in .env");
  }

  const documents = buildSeedArticleDocuments(CANONICAL_SEED_ARTICLES, now);
  console.log(`\nCreating/replacing ${documents.length} seed articles...`);
  for (const doc of documents) {
    await client.createOrReplace(doc as { _id: string; _type: string; [key: string]: unknown });
    console.log(`  upserted ${doc._id}`);
  }

  console.log("\nArticle write complete.");
}

async function main(): Promise<void> {
  const { dryRun, write } = parseArgs(process.argv.slice(2));

  if (write) {
    await runArticlesWrite();
    return;
  }

  if (dryRun) {
    await runArticlesDryRun();
    return;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("article reseed failed:", error);
    process.exit(1);
  });
}
