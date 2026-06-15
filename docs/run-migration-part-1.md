# Run Migration Part 1 (Legacy -> Fetcher Worker)

This document tracks Part 1 of the run migration for Angle ingestion.

## Goal

Disconnect `run1`/`run2`/`run3`/`run4` from the legacy direct-to-Sanity path and
rewire those run scripts to Fetcher Worker behavior only:

```text
run config -> scrape -> normalize -> Supabase pending
```

## What changed in Part 1

1. Added new Fetcher Worker modules:
   - `src/fetcherWorker/types.ts`
   - `src/fetcherWorker/config.ts`
   - `src/fetcherWorker/runFetcherBatch.ts`
2. Added new run entrypoint:
   - `src/core/runFetcherOnce.ts`
3. Rewired public run scripts:
   - `run:run1` .. `run:run4` now call `runFetcherOnce.ts`
4. Added Fetcher Worker scripts:
   - `fetcher:run`
   - `fetcher:run:dry-run`
   - `fetcher:verify`
5. Added legacy namespaced scripts:
   - `legacy:run:run1` .. `legacy:run:run4`
6. Added hard legacy guard in `src/core/runOnce.ts`:
   - requires `ALLOW_LEGACY_DIRECT_SANITY=true`
7. Marked editorial auto-placement config as legacy:
   - `src/gunner/editorialConfig.ts` now has deprecation guidance

## Behavior after Part 1

`npm run run:run1` now:

1. Loads `run1` from `SCRAPING_RUNS`
2. Scrapes configured sources and counts
3. Normalizes candidates
4. Validates candidates for insert
5. In dry-run mode, writes audit only
6. In write mode, inserts rows in Supabase as `pending`

It no longer:

- calls legacy middleware (`src/middleware/*`)
- calls legacy gunner (`src/gunner/*`)
- creates Sanity docs
- publishes
- applies editorial/homepage flags

## Legacy code policy in Part 1

Legacy code is intentionally retained for rollback safety and historical
reference. It is not removed in this phase.

Protected legacy execution:

```bash
ALLOW_LEGACY_DIRECT_SANITY=true npm run legacy:run:run1
```

Without that env, legacy run entrypoint refuses execution.

## Artifacts

Fetcher Worker writes:

- `audit-output/fetcher-worker/summary.json`
- `audit-output/fetcher-worker/FETCHER_WORKER_AUDIT.md`

## Part 2 preview

Part 2 will cover:

- GitHub Actions scheduling and orchestration updates
- AI Worker and Gunner Worker cadence strategy
- operational rollout checks
- legacy middleware/gunner archival or removal once stable
