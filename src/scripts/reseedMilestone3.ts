/**
 * Milestone 3 orchestrator: delete dummy articles, reseed taxonomy, upsert seed author,
 * create canonical seed articles, and refresh local fixtures.
 *
 * Default: dry-run only (no Sanity writes).
 * Live write requires CONFIRM_SANITY_ARTICLE_RESEED=YES and --write.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSanityClient } from "../sanity/client";
import { clearCategoryCache } from "../sanity/categoryCache";
import { clearTagCache } from "../sanity/tagCache";
import { SEED_AUTHOR_ID } from "../utils/data/canonical-articles";
import { validateCanonicalTaxonomy } from "../utils/data/canonical-taxonomy";
import {
  assertHomepageTagCoverage,
  validateCanonicalArticles,
} from "../utils/data/validateCanonicalArticles";
import {
  deleteObsoleteTaxonomy,
  fetchExistingTaxonomy,
  fetchReferencedTaxonomyIds,
  printPlannedTaxonomyUpserts,
  summarizeTaxonomyDiff,
  upsertCanonicalTaxonomy,
} from "../utils/data/taxonomyReseedOps";
import { runArticlesDryRun, runArticlesWrite } from "./reseedArticles";
import { fetchCategories } from "./categoryFetcher";
import { fetchTags } from "./tagFetcher";

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath, override: false });

const CONFIRM_ENV = "CONFIRM_SANITY_ARTICLE_RESEED";
const ARTICLE_TYPES = ["post", "opinion", "analysis", "sponsored"];

interface ExistingArticle {
  _id: string;
  _type: string;
  title?: string;
}

function parseArgs(argv: string[]): { dryRun: boolean; write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run") || !write;
  return { dryRun, write };
}

function assertWriteConfirmation(): void {
  if (process.env[CONFIRM_ENV] !== "YES") {
    throw new Error(
      `Live milestone 3 reseed requires ${CONFIRM_ENV}=YES environment variable`
    );
  }
}

function printHeader(mode: string): void {
  console.log("=".repeat(72));
  console.log("Milestone 3 Reseed Orchestrator");
  console.log(`Mode: ${mode}`);
  console.log("=".repeat(72));
}

async function fetchExistingArticles(
  client: NonNullable<ReturnType<typeof getSanityClient>>
): Promise<ExistingArticle[]> {
  const published = await client.fetch<ExistingArticle[]>(
    `*[_type in $types]{ _id, _type, title }`,
    { types: ARTICLE_TYPES }
  );
  const drafts = await client.fetch<ExistingArticle[]>(
    `*[_id in path("drafts.**") && _type in $types]{ _id, _type, title }`,
    { types: ARTICLE_TYPES }
  );
  const merged = new Map<string, ExistingArticle>();
  for (const doc of [...(published ?? []), ...(drafts ?? [])]) {
    merged.set(doc._id, doc);
  }
  return Array.from(merged.values());
}

function printArticlesToDelete(articles: ExistingArticle[]): void {
  console.log(`\nExisting article-family docs that would be deleted: ${articles.length}`);
  if (articles.length === 0) {
    console.log("  (none)");
    return;
  }

  const byType: Record<string, number> = {};
  for (const article of articles) {
    byType[article._type] = (byType[article._type] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(byType).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${type}: ${count}`);
  }

  for (const article of articles.slice(0, 20)) {
    console.log(`  - ${article._id} | ${article._type} | ${article.title ?? "Untitled"}`);
  }
  if (articles.length > 20) {
    console.log(`  ... and ${articles.length - 20} more`);
  }
}

function buildSeedAuthorDocument(picture?: Record<string, unknown>) {
  return {
    _id: SEED_AUTHOR_ID,
    _type: "author",
    name: "Angle Staff",
    slug: { _type: "slug", current: "angle-staff" },
    email: "staff@anglenetwork.us",
    cmsRole: "author",
    canAccessStudio: false,
    title: "Editorial Staff",
    shortBio: "Angle editorial team byline for seed and system content.",
    ...(picture ? { picture } : {}),
  };
}

async function upsertSeedAuthor(
  client: NonNullable<ReturnType<typeof getSanityClient>>
): Promise<void> {
  const template = await client.fetch<{ picture?: Record<string, unknown> } | null>(
    `*[_type == "author" && defined(picture.asset._ref)][0]{ picture }`
  );

  const authorDoc = buildSeedAuthorDocument(template?.picture);
  await client.createOrReplace(authorDoc);
  console.log(`  upserted ${SEED_AUTHOR_ID}`);
}

async function deleteAllArticles(
  client: NonNullable<ReturnType<typeof getSanityClient>>
): Promise<void> {
  const articles = await fetchExistingArticles(client);
  console.log(`\nDeleting ${articles.length} article-family documents...`);
  for (const article of articles) {
    try {
      await client.delete(article._id);
      console.log(`  deleted ${article._id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  skipped ${article._id}: ${message}`);
    }
  }
}

async function refreshFixtures(): Promise<void> {
  console.log("\nRefreshing local fixtures from Sanity...");
  await fetchCategories();
  await fetchTags();
}

async function runDryRun(): Promise<void> {
  validateCanonicalTaxonomy();
  validateCanonicalArticles();
  assertHomepageTagCoverage();

  printHeader("DRY-RUN (no Sanity writes)");

  const client = getSanityClient();
  if (client) {
    const articles = await fetchExistingArticles(client);
    printArticlesToDelete(articles);

    printPlannedTaxonomyUpserts();
    const existing = await fetchExistingTaxonomy(client);
    const references = await fetchReferencedTaxonomyIds(client);
    summarizeTaxonomyDiff(existing, references);
  } else {
    console.log("\nSanity client unavailable; skipping remote article/taxonomy diff.");
    printPlannedTaxonomyUpserts();
  }

  console.log("\nSeed author upsert:");
  console.log(`  - ${SEED_AUTHOR_ID} | Angle Staff (angle-staff)`);
  console.log("  picture: copied from first existing author with image asset when writing");

  console.log("\nArticles to create:");
  await runArticlesDryRun();

  console.log("\nMilestone 3 dry-run complete. No changes were written.");
}

async function runWrite(): Promise<void> {
  assertWriteConfirmation();
  validateCanonicalTaxonomy();
  validateCanonicalArticles();
  assertHomepageTagCoverage();

  printHeader("WRITE (Sanity mutations enabled)");

  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client is unavailable. Check SANITY credentials in .env");
  }

  await deleteAllArticles(client);

  console.log("\nUpserting canonical taxonomy...");
  await upsertCanonicalTaxonomy(client);
  await deleteObsoleteTaxonomy(client);

  console.log("\nUpserting seed author...");
  await upsertSeedAuthor(client);

  console.log("\nCreating canonical seed articles...");
  await runArticlesWrite();

  clearCategoryCache();
  clearTagCache();
  await refreshFixtures();

  console.log("\nMilestone 3 write complete.");
}

async function main(): Promise<void> {
  const { dryRun, write } = parseArgs(process.argv.slice(2));

  if (write) {
    await runWrite();
    return;
  }

  if (dryRun) {
    await runDryRun();
    return;
  }
}

main().catch((error) => {
  console.error("milestone 3 reseed failed:", error);
  process.exit(1);
});
