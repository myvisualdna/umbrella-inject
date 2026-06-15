# Step 1: Fetcher Worker (`runX` -> `pending`)

Step 1 rewires `run1`/`run2`/`run3`/`run4` to a Fetcher Worker path that
scrapes configured sources, normalizes candidates, and inserts only
`pending` rows into Supabase `story_candidates`.

```text
run config (run1..run4)
-> scrape
-> normalize
-> Supabase story_candidates (status=pending)
```

## What this worker does

For one selected run (`--run=run1` style):

1. Loads the run recipe from `src/config/scrapingControl.ts`.
2. Filters sources where:
   - `count > 0`
   - scraper switch is enabled in `src/config/scraperSwitches.ts`
   - optional `FETCHER_SOURCE_KEYS` allowlist passes
3. Scrapes each selected source with run-specific `count`.
4. Reads latest scraped result files from `results/...`.
5. Normalizes each article with `normalizeStoryCandidate`.
6. Validates normalized candidates with `validateForInsert`.
7. Inserts valid candidates with dedupe semantics on `source_url` (write mode).
8. Writes audit artifacts:
   - `audit-output/fetcher-worker/summary.json`
   - `audit-output/fetcher-worker/FETCHER_WORKER_AUDIT.md`

## What this worker does NOT do

- No OpenAI calls
- No AI worker execution
- No Gunner Worker execution
- No legacy ChatGPT middleware execution
- No legacy Sanity Gunner execution
- No Sanity draft creation
- No publishing
- No homepage/editorial flag auto-application

## Safety controls

Environment flags:

- `FETCHER_DRY_RUN=true|false` (default: `true`)
- `FETCHER_WRITE_ENABLED=true|false` (default: `false`)
- `FETCHER_RUN_ID=run1|run2|run3|run4` (optional if `--run=` is passed)
- `FETCHER_SOURCE_KEYS=comma,separated,sourceKeys` (optional)
- `FETCHER_MAX_TOTAL_ARTICLES=number` (optional safety cap)

Write behavior:

- Dry-run: scrape + normalize + audit; **no Supabase insert**
- Write mode requires:
  - `FETCHER_DRY_RUN=false`
  - `FETCHER_WRITE_ENABLED=true`

## Scripts

```bash
# Public run scripts (now Fetcher Worker)
npm run run:run1
npm run run:run2
npm run run:run3
npm run run:run4

# Direct fetcher scripts
npm run fetcher:run -- --run=run1
npm run fetcher:run:dry-run -- --run=run1
npm run fetcher:verify
```

## Legacy pipeline status

Legacy direct-to-Sanity path is preserved but guarded.

- Legacy entrypoint: `src/core/runOnce.ts`
- Guard env: `ALLOW_LEGACY_DIRECT_SANITY=true`
- Without that env, legacy runs fail fast with a safety message.

Legacy scripts are intentionally namespaced:

```bash
npm run legacy:run:run1
npm run legacy:run:run2
npm run legacy:run:run3
npm run legacy:run:run4
```
