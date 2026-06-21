# Canonical Article Seed (Milestone 3)

Milestone 3 replaces legacy dummy articles with a deterministic seed manifest aligned to the canonical taxonomy.

Source of truth:

- [`src/utils/data/canonical-articles.ts`](../src/utils/data/canonical-articles.ts)
- [`src/utils/data/validateCanonicalArticles.ts`](../src/utils/data/validateCanonicalArticles.ts)
- [`src/utils/data/buildSeedArticleDocuments.ts`](../src/utils/data/buildSeedArticleDocuments.ts)

## Seed inventory

- **36 total articles**
  - 24 posts (3 per category × 8 categories)
  - 8 analysis (1 per category)
  - 4 opinion (global, no category/tags)
- Deterministic document IDs:
  - `post.seed.{categorySlug}.{001-003}`
  - `analysis.seed.{categorySlug}.001`
  - `opinion.seed.{001-004}`

## Publication dates

- `publishedAt` is computed at reseed time from `publishedAtOffsetHours`.
- Offsets must stay within the last **14 days** (`[0, 336]` hours).
- Index 0 is most recent (~2 hours ago); later articles spread backward.
- `updatedAt = publishedAt + 15 minutes` (never future-dated).

## Title rules

- Opinion and analysis titles must **not** contain the words `opinion` or `analysis` (case-insensitive).
- Analysis documents require `analysisFocus`.

## Taxonomy references

- Categories: `category.{slug}`
- Tags: `tag.{categorySlug}.{tagSlug}` (category-scoped)
- Author: `author.angle-staff`

Homepage third-section tags are covered by seed data: `congress`, `white-house`, `artificial-intelligence`, `china`.

## Orchestration order (live reseed)

`npm run milestone3:reseed` runs in this order:

1. Delete all `post`, `opinion`, `analysis`, and `sponsored` documents (including drafts)
2. Upsert canonical categories and tags
3. Delete orphan non-canonical taxonomy documents
4. Upsert seed author `author.angle-staff`
5. Create/replace canonical seed articles
6. Run `sync-all` to refresh local fixtures

Article-only reseed (`articles:reseed`) creates/replaces seed documents only; it does **not** delete existing articles or reseed taxonomy.

## Commands

```bash
# Offline manifest validation (no network)
npm run articles:verify

# Preview article upserts only
npm run articles:reseed:dry-run

# Preview full Milestone 3 orchestration (default for M3 work)
npm run milestone3:dry-run

# Live write (requires explicit confirmation)
CONFIRM_SANITY_ARTICLE_RESEED=YES npm run milestone3:reseed
```

## Safety

- Dry-run is the default for article and Milestone 3 scripts.
- Live writes require `CONFIRM_SANITY_ARTICLE_RESEED=YES`.
- Seed covers use placeholder media (no Unsplash uploads).
- Verification scripts do not call OpenAI, Gunner, or the ingestion pipeline.

## Deprecation

Legacy article seeding in `next-sanity-blog/scripts/seed-articles.mjs` is deprecated. Use the Milestone 3 scripts in `news-ingestion` instead.
