# Legacy Direct-to-Sanity Pipeline Removal

The legacy monolithic ingestion path was removed from `news-ingestion`. The
repository now supports a single production pipeline:

```text
Fetcher Worker -> Supabase (pending)
  -> AI Worker -> Supabase (processed)
  -> Gunner Worker -> Sanity drafts (manual publish in Studio)
```

## What was removed

- Legacy run entrypoints (`runOnce.ts`, `legacyScheduler.ts`, `scrapingRunner.ts`)
- ChatGPT middleware (`src/middleware/*` except body cleaning, now in `src/scraping/`)
- Image service (Wikimedia / Pexels / Pixabay cascade)
- Legacy direct Gunner (`orchestrator`, `mapper`, `editorialConfig`, etc.)
- npm scripts: `legacy:run:*`, `legacy:scraper`, `test-image`
- Env vars: `ALLOW_LEGACY_DIRECT_SANITY`, `CHATGPT_*`, `SANITY_GUNNER_ENABLED`,
  `WIKIMEDIA_USER_AGENT`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`

## What was preserved / relocated

| Module | Location |
|--------|----------|
| Body cleaning | `src/scraping/cleanArticleBody.ts`, `cleaningPatterns.ts` |
| Scraper dispatch | `src/core/scraperDispatch.ts` |
| Sanity client + caches | `src/sanity/*` |
| Fetcher / AI / Gunner workers | `src/fetcherWorker/`, `src/ai/`, `src/gunnerWorker/` |

## Images

- AI Worker does not select images.
- Gunner Worker uses built-in branded placeholder cover defaults in `src/gunnerWorker/cover.ts` (optional `GUNNER_PLACEHOLDER_COVER_*` overrides).
- Editors replace image and credits during Sanity review before publishing.

## AI provider

The AI Worker uses `src/ai/*` with `OPENAI_API_KEY` (not the removed `CHATGPT_API_KEY`).

## Audit artifact

Detailed file lists and verification results: `audit-output/legacy-cleanup/`.
