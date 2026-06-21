/**
 * Append analysis and opinion seed articles without deleting or replacing existing docs.
 *
 * Creates:
 *   - 20 analysis.append.{category}.{001-003} (first canonical tag per category)
 *   - 20 opinion.append.{001-020} (global, no category/tags)
 *
 * Default: dry-run only.
 * Live write requires CONFIRM_SANITY_EDITORIAL_APPEND=YES and --write.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSanityClient } from "../sanity/client";
import {
  APPEND_ANALYSIS_COUNT,
  APPEND_EDITORIAL_ARTICLES,
  APPEND_OPINION_COUNT,
} from "../utils/data/buildAppendEditorialArticles";
import { buildSeedArticleDocuments } from "../utils/data/buildSeedArticleDocuments";
import { SEED_AUTHOR_ID } from "../utils/data/canonical-articles";
import { validateSeedArticleList } from "../utils/data/validateCanonicalArticles";

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath, override: false });

const CONFIRM_ENV = "CONFIRM_SANITY_EDITORIAL_APPEND";

function parseArgs(argv: string[]): { dryRun: boolean; write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run") || !write;
  return { dryRun, write };
}

function assertWriteConfirmation(): void {
  if (process.env[CONFIRM_ENV] !== "YES") {
    throw new Error(
      `Live editorial append requires ${CONFIRM_ENV}=YES environment variable`
    );
  }
}

function printPlan(existingIds: Set<string>): void {
  const toCreate = APPEND_EDITORIAL_ARTICLES.filter((article) => !existingIds.has(article.id));
  const analysis = toCreate.filter((article) => article.articleType === "analysis");
  const opinion = toCreate.filter((article) => article.articleType === "opinion");

  console.log(`\nAppend editorial articles:`);
  console.log(`  analysis to create: ${analysis.length} (target ${APPEND_ANALYSIS_COUNT})`);
  console.log(`  opinion to create: ${opinion.length} (target ${APPEND_OPINION_COUNT})`);
  console.log(`  skipped (already exist): ${APPEND_EDITORIAL_ARTICLES.length - toCreate.length}`);

  console.log("\nAnalysis by category:");
  for (const article of analysis) {
    const tags = article.tagSlugs?.join(", ") ?? "";
    console.log(`  ${article.id} | ${article.categorySlug} | tags: ${tags}`);
  }

  console.log("\nOpinion:");
  for (const article of opinion) {
    console.log(`  ${article.id} | ${article.slug}`);
  }
}

async function run(): Promise<void> {
  const { dryRun, write } = parseArgs(process.argv.slice(2));
  if (write) assertWriteConfirmation();

  validateSeedArticleList(APPEND_EDITORIAL_ARTICLES);

  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client unavailable. Check SANITY credentials in .env");
  }

  console.log("=".repeat(72));
  console.log("Append Editorial Articles");
  console.log(`Mode: ${dryRun ? "dry-run" : "live write"}`);
  console.log("=".repeat(72));

  const authorExists = await client.fetch<boolean>(`*[_id == $id][0]._id != null`, {
    id: SEED_AUTHOR_ID,
  });
  if (!authorExists) {
    throw new Error(`Missing seed author ${SEED_AUTHOR_ID}. Run milestone3:reseed first.`);
  }

  const existingIds = new Set<string>(
    await client.fetch<string[]>(
      `*[_type in ["analysis", "opinion"] && (_id match "analysis.append.**" || _id match "opinion.append.**")]._id`
    )
  );

  printPlan(existingIds);

  const documents = buildSeedArticleDocuments(
    APPEND_EDITORIAL_ARTICLES.filter((article) => !existingIds.has(article.id))
  );

  if (documents.length === 0) {
    console.log("\nNothing to create — append editorial articles already exist.");
    return;
  }

  if (dryRun) {
    console.log("\nDry run complete. Re-run with --write to create documents.");
    return;
  }

  console.log(`\nCreating ${documents.length} append editorial articles...`);
  let created = 0;
  for (const doc of documents) {
    await client.createIfNotExists(doc as { _id: string; _type: string; [key: string]: unknown });
    created += 1;
    if (created % 10 === 0 || created === documents.length) {
      console.log(`  created ${created}/${documents.length}`);
    }
  }

  const [analysisCount, opinionCount, appendAnalysisCount, appendOpinionCount] =
    await Promise.all([
      client.fetch<number>(`count(*[_type == "analysis"])`),
      client.fetch<number>(`count(*[_type == "opinion"])`),
      client.fetch<number>(
        `count(*[_type == "analysis" && _id match "analysis.append.**"])`
      ),
      client.fetch<number>(
        `count(*[_type == "opinion" && _id match "opinion.append.**"])`
      ),
    ]);

  console.log("\nPost-append summary:");
  console.log(`  analysis total: ${analysisCount} (append: ${appendAnalysisCount})`);
  console.log(`  opinion total: ${opinionCount} (append: ${appendOpinionCount})`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
