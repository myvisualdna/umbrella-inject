# GitHub Actions Batch Handoff (Manual Update Guide)

This document provides exact snippets to update scheduled workflows manually.
Do **not** enable real OpenAI or live Gunner writes in this phase.

Workflow files were intentionally left unchanged during rollout-readiness work.
Apply these updates yourself when ready.

## Target production behavior

```text
Scheduled run1/run2/run3/run4 workflow
-> Fetcher job creates batch X and inserts N candidates
-> AI job receives batch X and processes exactly those N candidates
-> Gunner job receives batch X and drafts exactly the processed candidates
-> Editors review/publish manually in Sanity
```

## Prerequisites

1. Apply Supabase migration:
   - `next-sanity-blog/supabase-migrations/20260615_story_candidate_batches.sql`
2. Verify migration:
   - `npm run db:verify-batch-migration`
3. Configure GitHub secrets/variables (names only):
   - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SANITY_API_WRITE_TOKEN`
   - Variables: `NEWS_PIPELINE_SCHEDULED_ENABLED`, `NEWS_FETCHER_ENABLED`, `NEWS_AI_WORKER_ENABLED`, `NEWS_GUNNER_WORKER_ENABLED`, plus existing pipeline limits

## Fetcher job

### Commands

```bash
FETCHER_WRITE_ENABLED=true npm run run:run1
npm run github:outputs:fetcher
```

Replace `run:run1` with the workflow run id as needed.

### Step outputs capture

```yaml
- name: Emit fetcher batch outputs
  id: fetcher_outputs
  run: npm run github:outputs:fetcher
```

### Job outputs

```yaml
outputs:
  batch_id: ${{ steps.fetcher_outputs.outputs.batch_id }}
  inserted_count: ${{ steps.fetcher_outputs.outputs.inserted_count }}
  run_id: ${{ steps.fetcher_outputs.outputs.run_id }}
```

## AI job

### Run condition

```yaml
if: needs.fetcher.outputs.inserted_count != '0'
```

### Environment

```yaml
env:
  AI_BATCH_ID: ${{ needs.fetcher.outputs.batch_id }}
  AI_EXPECTED_COUNT: ${{ needs.fetcher.outputs.inserted_count }}
  AI_STRICT_BATCH_COUNTS: "true"
```

### Commands (future live phase only)

Do **not** run with `AI_PROVIDER=openai` in this rollout-readiness phase.
Real OpenAI verification is deferred to a separate future prompt.

Future command shape:

```bash
npm run ai:process-pending
npm run github:outputs:ai
```

For safe testing before OpenAI enablement, use mock/dry-run only:

```bash
AI_PROVIDER=mock AI_DRY_RUN=true npm run ai:process-pending:dry-run
npm run github:outputs:ai
```

### Step outputs capture

```yaml
- name: Emit AI batch outputs
  id: ai_outputs
  run: npm run github:outputs:ai
```

### Job outputs

```yaml
outputs:
  processed_count: ${{ steps.ai_outputs.outputs.processed_count }}
```

## Gunner job

### Run condition

```yaml
if: needs.ai.outputs.processed_count != '0'
```

### Environment

```yaml
env:
  GUNNER_BATCH_ID: ${{ needs.fetcher.outputs.batch_id }}
  GUNNER_EXPECTED_COUNT: ${{ needs.ai.outputs.processed_count }}
  GUNNER_STRICT_BATCH_COUNTS: "true"
```

Do **not** set `GUNNER_WRITE_ENABLED=true` in this phase.
Live Gunner draft verification is deferred to a separate future prompt.

Future command shape:

```bash
npm run gunner:create-drafts
npm run github:outputs:gunner
```

For safe testing before live writes:

```bash
GUNNER_WRITE_ENABLED=false npm run gunner:create-drafts:dry-run
npm run github:outputs:gunner
```

### Step outputs capture

```yaml
- name: Emit Gunner batch outputs
  id: gunner_outputs
  run: npm run github:outputs:gunner
```

## Recommended rollout order

1. Apply Supabase migration
2. Run `npm run db:verify-batch-migration`
3. Configure GitHub secrets and variables
4. Update GitHub Actions to pass batch outputs between jobs
5. Enable Fetcher only (`NEWS_FETCHER_ENABLED=true`, AI/Gunner disabled)
6. Verify pending candidates and batch rows (`npm run queue:health`)
7. Prepare a separate prompt for real OpenAI verification
8. Prepare a separate prompt for live Gunner draft verification
9. Only after those separate validations, enable scheduled AI/Gunner

## Emergency pause / rollback

Pause all scheduled stages:

```text
NEWS_PIPELINE_SCHEDULED_ENABLED=false
NEWS_FETCHER_ENABLED=false
NEWS_AI_WORKER_ENABLED=false
NEWS_GUNNER_WORKER_ENABLED=false
```

Pause one stage only:

```text
NEWS_FETCHER_ENABLED=false
NEWS_AI_WORKER_ENABLED=false
NEWS_GUNNER_WORKER_ENABLED=false
```

Legacy direct pipeline was removed. Pause via repository variables above or
workflow dry-run defaults. See [`docs/legacy-cleanup.md`](legacy-cleanup.md).

## Resume safely

1. Confirm pause flags are set as intended.
2. Run `npm run db:verify-batch-migration`.
3. Run `npm run queue:health` and inspect pending/failed counts.
4. Re-enable Fetcher only and verify one scheduled batch end-to-end in dry-run/mock where possible.
5. Re-enable AI only after separate real OpenAI validation prompt is completed.
6. Re-enable Gunner only after separate live draft validation prompt is completed.
7. Keep `AI_STRICT_BATCH_COUNTS=true` and `GUNNER_STRICT_BATCH_COUNTS=true` in scheduled workflows.

## Local readiness checks (safe)

```bash
npm run pipeline:batch:verify
npm run queue:health
npm run github:outputs:fetcher -- --allow-missing
npm run github:outputs:ai -- --allow-missing
npm run github:outputs:gunner -- --allow-missing
```

Use strict DB mode when migration must be present:

```bash
PIPELINE_STRICT_DB=true npm run pipeline:batch:verify
```
