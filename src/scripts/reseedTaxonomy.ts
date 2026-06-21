/**
 * Reseed Sanity categories and category-scoped tags from the canonical manifest.
 *
 * Default: dry-run only (no Sanity writes).
 * Real write requires explicit --write flag.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSanityClient } from "../sanity/client";
import { clearCategoryCache } from "../sanity/categoryCache";
import { clearTagCache } from "../sanity/tagCache";
import { validateCanonicalTaxonomy } from "../utils/data/canonical-taxonomy";
import { writeFixturesFromManifest } from "../utils/data/writeTaxonomyFixtures";
import {
  deleteObsoleteTaxonomy,
  fetchExistingTaxonomy,
  fetchReferencedTaxonomyIds,
  printPlannedTaxonomyUpserts,
  summarizeTaxonomyDiff,
  upsertCanonicalTaxonomy,
} from "../utils/data/taxonomyReseedOps";
import { fetchCategories } from "./categoryFetcher";
import { fetchTags } from "./tagFetcher";

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath, override: false });

function parseArgs(argv: string[]): { dryRun: boolean; write: boolean; writeFixtures: boolean } {
  const write = argv.includes("--write");
  const writeFixtures = argv.includes("--write-fixtures");
  const dryRun = argv.includes("--dry-run") || (!write && !writeFixtures);
  return { dryRun, write, writeFixtures };
}

function printHeader(mode: string): void {
  console.log("=".repeat(72));
  console.log("Canonical Taxonomy Reseed");
  console.log(`Mode: ${mode}`);
  console.log("=".repeat(72));
}

async function runDryRun(): Promise<void> {
  validateCanonicalTaxonomy();
  printHeader("DRY-RUN (no Sanity writes)");
  printPlannedTaxonomyUpserts();

  const client = getSanityClient();
  if (!client) {
    console.log("\nSanity client unavailable; skipping remote diff.");
    return;
  }

  const existing = await fetchExistingTaxonomy(client);
  const references = await fetchReferencedTaxonomyIds(client);
  summarizeTaxonomyDiff(existing, references);

  console.log("\nDry-run complete. No changes were written.");
}

async function runWrite(): Promise<void> {
  validateCanonicalTaxonomy();
  printHeader("WRITE (Sanity mutations enabled)");

  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client is unavailable. Check SANITY credentials in .env");
  }

  await upsertCanonicalTaxonomy(client);
  await deleteObsoleteTaxonomy(client);

  clearCategoryCache();
  clearTagCache();

  console.log("\nRefreshing local fixtures from Sanity...");
  await fetchCategories();
  await fetchTags();

  console.log("\nWrite complete.");
}

async function main(): Promise<void> {
  const { dryRun, write, writeFixtures } = parseArgs(process.argv.slice(2));

  if (writeFixtures) {
    const result = writeFixturesFromManifest();
    clearCategoryCache();
    clearTagCache();
    console.log("Wrote taxonomy fixtures from canonical manifest:");
    console.log(`  categories: ${result.categoryCount} -> ${result.categoriesPath}`);
    console.log(`  tags: ${result.tagCount} -> ${result.tagsPath}`);
    return;
  }

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
  console.error("taxonomy reseed failed:", error);
  process.exit(1);
});
