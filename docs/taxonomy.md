# Canonical Taxonomy

Angle uses a category-scoped tag taxonomy in Sanity:

- 8 canonical categories
- 37 canonical tags (each tag belongs to exactly one category)
- Tag slugs are globally unique across all categories

The canonical source of truth lives in:

- [`src/utils/data/canonical-taxonomy.ts`](../src/utils/data/canonical-taxonomy.ts)

## Categories

| Title | Slug |
| --- | --- |
| US | `us` |
| World | `world` |
| Politics | `politics` |
| Business | `business` |
| Science | `science` |
| Entertainment | `entertainment` |
| Tech | `tech` |
| Lifestyle | `lifestyle` |

## Tag rules

- Every tag document has a required `category` reference.
- Tag slugs must be globally unique (for example `artificial-intelligence`, not `ai`).
- Posts may only use tags from their selected category (enforced in Studio, AI, and Gunner).

## Deterministic document IDs

Reseed uses stable Sanity document ids:

- Categories: `category.{slug}` (example: `category.politics`)
- Tags: `tag.{categorySlug}.{tagSlug}` (example: `tag.politics.white-house`)

## Commands

```bash
# Validate manifest + offline fixtures (no network)
npm run taxonomy:verify

# Preview Sanity upserts/deletes (no writes)
npm run taxonomy:reseed:dry-run

# Regenerate local JSON fixtures from manifest (no Sanity)
npm run taxonomy:reseed:fixtures

# Write categories + tags to Sanity (requires write token)
npm run taxonomy:reseed

# Refresh local caches after a live reseed
npm run sync-all
```

## Milestone notes

- Milestone 2 reseeds categories and tags only.
- Milestone 3 deletes dummy articles, applies this taxonomy, and reseeds canonical articles via `npm run milestone3:reseed` (see [`docs/articles-seed.md`](articles-seed.md)).
- Legacy seed scripts in `next-sanity-blog/scripts/seed-*.mjs` are deprecated; they delete posts and do not set tag categories.

## Safety

- Standalone taxonomy reseed (`taxonomy:reseed`) does not modify or delete posts/articles.
- Milestone 3 orchestration deletes all article-family documents before taxonomy cleanup.
- Dry-run is the default unless `--write` is passed explicitly.
- AI/Gunner verification uses local fixture files and does not call OpenAI or write Sanity drafts.
