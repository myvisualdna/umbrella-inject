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
5. Added legacy namespaced scripts (removed in legacy cleanup — see `docs/legacy-cleanup.md`)
6. Added hard legacy guard in `src/core/runOnce.ts` (removed)
7. Marked editorial auto-placement config as legacy (removed with legacy Gunner)

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

## Legacy code policy (completed)

The legacy direct-to-Sanity pipeline was **removed** after staged production
validation. Part 1 rewired public run scripts to Fetcher Worker only; legacy
rollback scripts and middleware/gunner direct-write code no longer exist.

See [`docs/legacy-cleanup.md`](legacy-cleanup.md) for the removal audit.

## Artifacts

Fetcher Worker writes:

- `audit-output/fetcher-worker/summary.json`
- `audit-output/fetcher-worker/FETCHER_WORKER_AUDIT.md`

## Part 2 preview (completed)

Part 2 covered GitHub Actions scheduling, AI/Gunner worker cadence, batch-aware
orchestration, and operational rollout checks. Legacy direct-to-Sanity code was
subsequently removed; see [`docs/legacy-cleanup.md`](legacy-cleanup.md).
