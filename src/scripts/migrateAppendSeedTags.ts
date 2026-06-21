/**
 * Re-tag append-only layout seed posts (post.append.*) with each category's
 * first canonical tag, then delete obsolete layout-seed-batch tag documents.
 *
 * Default: dry-run only.
 * Live write requires CONFIRM_SANITY_APPEND_TAG_MIGRATION=YES and --write.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSanityClient } from "../sanity/client";
import {
  buildFirstCanonicalTagIdByCategory,
  buildLayoutSeedBatchTagIds,
  CANONICAL_CATEGORIES,
  getFirstCanonicalTagForCategory,
  LAYOUT_SEED_BATCH_TAG_SLUG,
} from "../utils/data/canonical-taxonomy";

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath, override: false });

const CONFIRM_ENV = "CONFIRM_SANITY_APPEND_TAG_MIGRATION";

type AppendPostRow = {
  _id: string;
  title: string;
  categorySlug: string | null;
};

function parseArgs(argv: string[]): { dryRun: boolean; write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run") || !write;
  return { dryRun, write };
}

function assertWriteConfirmation(): void {
  if (process.env[CONFIRM_ENV] !== "YES") {
    throw new Error(
      `Live append tag migration requires ${CONFIRM_ENV}=YES environment variable`
    );
  }
}

async function fetchAppendPosts(client: NonNullable<ReturnType<typeof getSanityClient>>) {
  return client.fetch<AppendPostRow[]>(`
    *[_type == "post" && _id match "post.append.*"]{
      _id,
      title,
      "categorySlug": category->slug.current
    } | order(_id asc)
  `);
}

async function verifyCanonicalTagIds(
  client: NonNullable<ReturnType<typeof getSanityClient>>
): Promise<void> {
  const tagIds = Object.values(buildFirstCanonicalTagIdByCategory());
  const existing = await client.fetch<{ _id: string }[]>(
    `*[_type == "tag" && _id in $ids]{ _id }`,
    { ids: tagIds }
  );
  const existingIds = new Set(existing.map((row) => row._id));
  const missing = tagIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Missing canonical tag documents in Sanity: ${missing.join(", ")}. Run taxonomy:reseed first.`
    );
  }
}

function printPlan(posts: AppendPostRow[]): void {
  const tagIdByCategory = buildFirstCanonicalTagIdByCategory();
  console.log("\nAppend posts to retag:");
  for (const category of CANONICAL_CATEGORIES) {
    const firstTag = getFirstCanonicalTagForCategory(category.slug);
    const categoryPosts = posts.filter((post) => post.categorySlug === category.slug);
    console.log(
      `  ${category.slug}: ${categoryPosts.length} posts -> ${firstTag.title} (${tagIdByCategory[category.slug]})`
    );
  }

  const unknownCategory = posts.filter(
    (post) => !post.categorySlug || !tagIdByCategory[post.categorySlug]
  );
  if (unknownCategory.length > 0) {
    console.log("\nPosts with missing/unknown category:");
    for (const post of unknownCategory) {
      console.log(`  ${post._id} (${post.categorySlug ?? "none"})`);
    }
  }
}

async function migratePosts(
  client: NonNullable<ReturnType<typeof getSanityClient>>,
  posts: AppendPostRow[],
  dryRun: boolean
): Promise<number> {
  const tagIdByCategory = buildFirstCanonicalTagIdByCategory();
  let patched = 0;

  for (const post of posts) {
    if (!post.categorySlug) {
      throw new Error(`Append post ${post._id} has no category`);
    }
    const tagId = tagIdByCategory[post.categorySlug];
    if (!tagId) {
      throw new Error(`No first canonical tag mapping for category ${post.categorySlug}`);
    }

    if (dryRun) {
      patched += 1;
      continue;
    }

    await client
      .patch(post._id)
      .set({
        tags: [
          {
            _key: `tag-${tagId}`,
            _type: "reference",
            _ref: tagId,
          },
        ],
      })
      .commit();
    patched += 1;

    if (patched % 20 === 0 || patched === posts.length) {
      console.log(`  retagged ${patched}/${posts.length}`);
    }
  }

  return patched;
}

async function deleteLayoutSeedBatchTags(
  client: NonNullable<ReturnType<typeof getSanityClient>>,
  dryRun: boolean
): Promise<void> {
  const tagIds = buildLayoutSeedBatchTagIds();

  if (!dryRun) {
    const remainingRefs = await client.fetch<number>(
      `count(*[_type in ["post","opinion","analysis","sponsored"] && references($ids)])`,
      { ids: tagIds }
    );

    if (remainingRefs > 0) {
      throw new Error(
        `${remainingRefs} documents still reference layout-seed-batch tags; aborting tag deletion`
      );
    }
  }

  console.log(`\nDeleting ${tagIds.length} layout-seed-batch tag documents...`);
  for (const tagId of tagIds) {
    if (dryRun) {
      console.log(`  [dry-run] delete ${tagId}`);
      continue;
    }
    await client.delete(tagId);
    console.log(`  deleted ${tagId}`);
  }
}

async function run(): Promise<void> {
  const { dryRun, write } = parseArgs(process.argv.slice(2));
  if (write) assertWriteConfirmation();

  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client unavailable. Check SANITY_API_TOKEN / project env.");
  }

  console.log("=".repeat(72));
  console.log("Append Seed Tag Migration");
  console.log(`Mode: ${dryRun ? "dry-run" : "live write"}`);
  console.log(`Target tag slug to remove: ${LAYOUT_SEED_BATCH_TAG_SLUG}`);
  console.log("=".repeat(72));

  await verifyCanonicalTagIds(client);

  const posts = await fetchAppendPosts(client);
  console.log(`\nFound ${posts.length} append posts (post.append.*)`);

  if (posts.length === 0) {
    console.log("No append posts to migrate.");
  } else {
    printPlan(posts);
    console.log(`\nRetagging append posts${dryRun ? " (dry-run)" : ""}...`);
    const patched = await migratePosts(client, posts, dryRun);
    console.log(`Retagged ${patched} append posts.`);
  }

  await deleteLayoutSeedBatchTags(client, dryRun);

  if (dryRun) {
    console.log("\nDry run complete. Re-run with --write to apply changes.");
    return;
  }

  const layoutTagCount = await client.fetch<number>(
    `count(*[_type == "tag" && slug.current == $slug])`,
    { slug: LAYOUT_SEED_BATCH_TAG_SLUG }
  );
  const appendPostCount = await client.fetch<number>(
    `count(*[_type == "post" && _id match "post.append.*"])`
  );
  const totalPublished = await client.fetch<number>(
    `count(*[_type in ["post","opinion","analysis"] && status == "published"])`
  );

  console.log("\nPost-migration summary:");
  console.log(`  layout-seed-batch tags remaining: ${layoutTagCount}`);
  console.log(`  append posts remaining: ${appendPostCount}`);
  console.log(`  published editorial docs: ${totalPublished}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
