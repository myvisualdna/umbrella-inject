# Batch-Aware Orchestration

This document explains how staged ingestion runs are now tied to a single batch, so each job processes only rows created for that run.

## Why batch awareness was added

Queue-only behavior can mix rows from different runs. When a fetcher run inserts 3 rows, a later AI/Gunner job could otherwise process older queue rows first.

Batch mode fixes this by linking each candidate to a batch ID and passing that ID through all stages.

## Batch flow

```text
Fetcher Worker
creates batch_id
inserts pending candidates with ingestion_batch_id + ingestion_run_id
-> AI Worker (AI_BATCH_ID=batch_id)
-> Gunner Worker (GUNNER_BATCH_ID=batch_id)
```

## Database model

Migration: `next-sanity-blog/supabase-migrations/20260615_story_candidate_batches.sql`

- New table: `public.story_candidate_batches`
- New candidate columns:
  - `story_candidates.ingestion_batch_id`
  - `story_candidates.ingestion_run_id`
- New indexes:
  - `story_candidates(ingestion_batch_id, status)`
  - `story_candidates(ingestion_run_id, created_at)`
  - `story_candidate_batches(run_id, created_at)`
  - `story_candidate_batches(status, created_at)`

## Fetcher behavior

- Write mode:
  1. Creates `story_candidate_batches` row (`status=fetching`)
  2. Inserts candidates with `ingestion_batch_id` and `ingestion_run_id`
  3. Marks batch `fetched` and updates counts
- Dry-run mode:
  - Creates local dry-run batch ID (`dry-run-...`) without DB writes

Fetcher artifacts:

- `audit-output/fetcher-worker/summary.json`
- `audit-output/fetcher-worker/FETCHER_WORKER_AUDIT.md`
- `audit-output/fetcher-worker/latest-batch.json`

## AI behavior

### Batch mode

If `AI_BATCH_ID` is set, AI selects only:

- `status='pending'`
- `ingestion_batch_id=AI_BATCH_ID`

Default in batch mode is to process all pending rows in that batch unless `AI_PROCESS_LIMIT` is explicitly set.

Batch status lifecycle:

- Before processing: `ai_processing`
- On complete reconciliation: `ai_completed`
- On unrecoverable error: `failed`

AI artifacts:

- `audit-output/ai-worker/summary.json`
- `audit-output/ai-worker/AI_WORKER_AUDIT.md`
- `audit-output/ai-worker/latest-batch.json`

## Gunner behavior

### Batch mode

If `GUNNER_BATCH_ID` is set, Gunner selects only:

- `status='processed'`
- `ingestion_batch_id=GUNNER_BATCH_ID`

Default in batch mode is to process all processed rows in that batch unless `GUNNER_LIMIT` is explicitly set.

Batch status lifecycle:

- Before processing: `drafting`
- On complete reconciliation: `completed`
- On unrecoverable error: `failed`

Gunner artifacts:

- `audit-output/gunner-worker/summary.json`
- `audit-output/gunner-worker/GUNNER_WORKER_AUDIT.md`
- `audit-output/gunner-worker/latest-batch.json`

## Batch mode vs queue mode

- Batch mode (`AI_BATCH_ID` / `GUNNER_BATCH_ID` set):
  - stage processes only one batch
  - used for scheduled/staged orchestration
- Queue mode (no batch envs):
  - existing conservative queue behavior remains
  - used for manual cleanup/backfill

## Count reconciliation

AI supports:

- `AI_EXPECTED_COUNT`
- `AI_STRICT_BATCH_COUNTS=true|false`

Gunner supports:

- `GUNNER_EXPECTED_COUNT`
- `GUNNER_STRICT_BATCH_COUNTS=true|false`

Strict mode fails the command when reconciliation does not match expected counts.

## Failure handling

- Batch-level failures are recorded via `story_candidate_batches.last_error` and `status='failed'`.
- Live batch mode fails clearly if migration columns/tables are missing.
- Legacy direct pipeline remains guarded and is not part of this orchestration.

## Rollout readiness tooling

Safe scripts for controlled production rollout:

- `npm run db:verify-batch-migration` — read-only migration presence check
- `npm run queue:health` — read-only queue/batch health report
- `npm run github:outputs:fetcher|ai|gunner` — emit GitHub job outputs from `latest-batch.json`
- `npm run pipeline:batch:verify` — local readiness verification (no OpenAI, no Sanity writes)

Manual GitHub Actions wiring instructions:

- `docs/github-actions-batch-handoff.md`

Real OpenAI verification and live Gunner draft verification are intentionally deferred to separate future prompts.

