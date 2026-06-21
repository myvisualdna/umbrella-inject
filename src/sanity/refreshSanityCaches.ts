import * as fs from "fs";
import * as path from "path";
import { logger } from "../config/logger";
import { clearAuthorCache, getAuthorCachePath } from "./authorCache";
import { clearCategoryCache, getCategoryCachePath } from "./categoryCache";
import { getSanityClient } from "./client";
import { SANITY_DATASET, SANITY_PROJECT_ID } from "./sanityConfig";
import { clearTagCache, getTagCachePath } from "./tagCache";

interface CategoryRow {
  _id: string;
  slug?: string;
  name?: string;
}

interface TagRow {
  _id: string;
  slug?: string;
  title?: string;
  aliases?: string[];
  category?: {
    _id?: string;
    slug?: string;
    title?: string;
  };
}

interface AuthorRow {
  _id: string;
  slug?: string;
  name?: string;
  email?: string;
}

export interface RefreshSanityCachesResult {
  projectId: string;
  dataset: string;
  categoriesLoaded: number;
  tagsLoaded: number;
  authorsLoaded: number;
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath: string, value: unknown): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function refreshSanityCaches(): Promise<RefreshSanityCachesResult> {
  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client is unavailable for cache refresh");
  }

  const categories = await client.fetch<CategoryRow[]>(
    `*[_type == "category"]{
      _id,
      "slug": slug.current,
      name
    } | order(name asc)`
  );
  const tags = await client.fetch<TagRow[]>(
    `*[_type == "tag"]{
      _id,
      "slug": slug.current,
      title,
      aliases,
      "category": category->{
        "_id": _id,
        "slug": slug.current,
        "title": name
      }
    } | order(title asc)`
  );
  const authors = await client.fetch<AuthorRow[]>(
    `*[_type == "author"]{
      _id,
      "slug": slug.current,
      name,
      email
    } | order(name asc)`
  );

  writeJson(getCategoryCachePath(), {
    lastUpdated: new Date().toISOString(),
    categories: (categories ?? []).map((cat) => ({
      _id: cat._id,
      slug: cat.slug || undefined,
      name: cat.name || undefined,
    })),
  });
  writeJson(getTagCachePath(), {
    lastUpdated: new Date().toISOString(),
    tags: (tags ?? []).map((tag) => ({
      _id: tag._id,
      slug: tag.slug || undefined,
      title: tag.title || undefined,
      aliases: Array.isArray(tag.aliases) ? tag.aliases : undefined,
      category: tag.category?._id
        ? {
            _id: tag.category._id,
            slug: tag.category.slug || undefined,
            title: tag.category.title || undefined,
          }
        : undefined,
    })),
  });
  writeJson(getAuthorCachePath(), {
    lastUpdated: new Date().toISOString(),
    authors: (authors ?? []).map((author) => ({
      _id: author._id,
      slug: author.slug || undefined,
      name: author.name || undefined,
      email: author.email || undefined,
    })),
  });

  clearCategoryCache();
  clearTagCache();
  clearAuthorCache();

  const result: RefreshSanityCachesResult = {
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    categoriesLoaded: categories?.length ?? 0,
    tagsLoaded: tags?.length ?? 0,
    authorsLoaded: authors?.length ?? 0,
  };

  logger.info("Sanity caches refreshed for Gunner Worker", result);
  return result;
}
