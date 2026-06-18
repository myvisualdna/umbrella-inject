# Run Migration Part 2 (Fetcher -> AI -> Gunner Orchestration)

Part 2 completes scheduling/orchestration migration for the queue-based pipeline.

## Goal

Move production orchestration from legacy assumptions to explicit staged jobs:

```text
run config
-> Fetcher Worker
-> Supabase pending
-> AI Worker
-> Supabase processed
-> Gunner Worker
-> Supabase draft_created + Sanity drafts
```

## What changed

1. Scheduled workflows were converted to staged jobs (Fetcher -> AI -> Gunner):
   - `.github/workflows/run1-weekdays.yml`
   - `.github/workflows/run2-weekdays.yml`
   - `.github/workflows/run3-weekdays.yml`
   - `.github/workflows/run4-weekdays.yml`
   - `.github/workflows/run5-WEEKENDS-only.yml`
2. New manual control surface workflow was added:
   - `.github/workflows/manual-ingestion-pipeline.yml`
3. Local scheduler default behavior is now fetcher-only:
   - `src/core/scheduler.ts`
4. Legacy direct execution path was additionally guarded close to danger:
   - `src/core/scrapingRunner.ts` (`executeRun*` now require `ALLOW_LEGACY_DIRECT_SANITY=true`)
5. Guarded legacy local scheduler entrypoint added:
   - `src/core/legacyScheduler.ts`
   - script: `npm run legacy:scraper`

## Behavior after Part 2

- Scheduled workflows no longer call legacy scripts.
- Scheduled workflows no longer depend on legacy middleware/gunner toggles.
- Scheduled workflows can be progressively enabled stage-by-stage using repository variables.
- Manual dispatch supports safe dry-run defaults with explicit opt-in for AI and Gunner stages.
- Legacy code remains in repository for rollback safety, but disabled by default.

## Stage enablement model

Scheduled runs use these repository variables:

- `NEWS_PIPELINE_SCHEDULED_ENABLED`
- `NEWS_FETCHER_ENABLED`
- `NEWS_AI_WORKER_ENABLED`
- `NEWS_GUNNER_WORKER_ENABLED`

Recommended rollout progression:

1. Enable scheduled fetcher only:
   - `NEWS_PIPELINE_SCHEDULED_ENABLED=true`
   - `NEWS_FETCHER_ENABLED=true`
   - `NEWS_AI_WORKER_ENABLED=false`
   - `NEWS_GUNNER_WORKER_ENABLED=false`
2. Enable AI stage after queue confidence.
3. Enable Gunner stage after AI quality and throughput checks.

## Legacy status

Legacy direct-to-Sanity path remains preserved but blocked unless explicitly enabled:

```bash
ALLOW_LEGACY_DIRECT_SANITY=true npm run legacy:run:run1
ALLOW_LEGACY_DIRECT_SANITY=true npm run legacy:scraper
```

Default run paths must remain staged (`run:runX`, scheduled workflows, manual-ingestion workflow).

## Artifacts

Part 2 migration artifacts:

- `audit-output/pipeline-migration/summary.json`
- `audit-output/pipeline-migration/PIPELINE_MIGRATION_PART_2.md`

## Remaining after Part 2

- Controlled production enablement of stage gates
- Operational monitoring/alerts for queue depth and stage failures
- Final legacy archive/removal once sustained production stability is confirmed

## Batch-aware orchestration follow-up

Part 2 introduced staged jobs but still allowed queue-wide selection. Batch-aware orchestration closes that gap:

- Fetcher now emits `batchId` and writes `audit-output/fetcher-worker/latest-batch.json`
- AI can be constrained by `AI_BATCH_ID`
- Gunner can be constrained by `GUNNER_BATCH_ID`
- Each stage emits a machine-readable latest-batch artifact for downstream jobs

Scheduled workflows should pass batch outputs forward so one run processes one batch end-to-end:

1. Fetcher outputs `batch_id` and `inserted_count`
2. AI receives `AI_BATCH_ID` + `AI_EXPECTED_COUNT`
3. AI outputs `processed_count`
4. Gunner receives `GUNNER_BATCH_ID` + `GUNNER_EXPECTED_COUNT`
