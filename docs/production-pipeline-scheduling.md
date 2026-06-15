# Production Pipeline Scheduling

This document describes the production-safe scheduling model for the staged ingestion pipeline.

## Final architecture

```text
run1/run2/run3/run4 schedules
-> Fetcher Worker (pending queue)
-> AI Worker (processed queue)
-> Gunner Worker (draft_created + Sanity draft)
```

The weekend workflow keeps existing behavior and uses the run2 source recipe.

## Scheduled workflows

- `.github/workflows/run1-weekdays.yml`
- `.github/workflows/run2-weekdays.yml`
- `.github/workflows/run3-weekdays.yml`
- `.github/workflows/run4-weekdays.yml`
- `.github/workflows/run5-WEEKENDS-only.yml`

Each workflow has three jobs in order:

1. Fetcher job (`run:runX`)
2. AI job (`ai:process-pending`)
3. Gunner job (`gunner:create-drafts`)

## Manual workflow

- `.github/workflows/manual-ingestion-pipeline.yml`

Inputs:

- `run_id` (`run1|run2|run3|run4`)
- `dry_run` (`true|false`)
- `run_ai` (`true|false`)
- `run_gunner` (`true|false`)
- `fetcher_limit`
- `ai_limit`
- `gunner_limit`

Safe defaults:

- `dry_run=true`
- `run_ai=false`
- `run_gunner=false`

## Required GitHub secrets (names only)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `SANITY_API_WRITE_TOKEN`

## Required GitHub repository variables (names only)

- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `NEWS_PIPELINE_SCHEDULED_ENABLED`
- `NEWS_FETCHER_ENABLED`
- `NEWS_AI_WORKER_ENABLED`
- `NEWS_GUNNER_WORKER_ENABLED`
- `FETCHER_MAX_TOTAL_ARTICLES`
- `AI_PROCESS_LIMIT`
- `GUNNER_LIMIT`
- `GUNNER_PLACEHOLDER_COVER_URL`
- `GUNNER_PLACEHOLDER_COVER_ALT`
- `GUNNER_PLACEHOLDER_COVER_CAPTION`
- `GUNNER_PLACEHOLDER_COVER_CREDIT_AUTHOR`
- `GUNNER_PLACEHOLDER_COVER_CREDIT_SOURCE`
- `GUNNER_PLACEHOLDER_COVER_LICENSE_OR_RIGHTS`
- `GUNNER_DEFAULT_AUTHOR_ID`

## Enablement progression

### 1) Fetcher-only schedule

Set:

- `NEWS_PIPELINE_SCHEDULED_ENABLED=true`
- `NEWS_FETCHER_ENABLED=true`
- `NEWS_AI_WORKER_ENABLED=false`
- `NEWS_GUNNER_WORKER_ENABLED=false`

### 2) Enable AI stage

Set:

- `NEWS_AI_WORKER_ENABLED=true`

Keep conservative `AI_PROCESS_LIMIT`.

### 3) Enable Gunner stage

Set:

- `NEWS_GUNNER_WORKER_ENABLED=true`

Keep conservative `GUNNER_LIMIT`.

## Manual dry-run examples

Fetcher-only dry-run:

```bash
FETCHER_DRY_RUN=true FETCHER_MAX_TOTAL_ARTICLES=3 npm run run:run1
```

AI dry-run with mock:

```bash
AI_PROVIDER=mock AI_DRY_RUN=true AI_PROCESS_LIMIT=1 npm run ai:process-pending:dry-run
```

Gunner dry-run:

```bash
GUNNER_LIMIT=1 npm run gunner:create-drafts:dry-run
```

## Pause / rollback

### Pause all scheduled stages

Set:

- `NEWS_PIPELINE_SCHEDULED_ENABLED=false`

### Pause specific stage

Set corresponding stage variable to `false`:

- `NEWS_FETCHER_ENABLED`
- `NEWS_AI_WORKER_ENABLED`
- `NEWS_GUNNER_WORKER_ENABLED`

### Legacy rollback (explicit, temporary)

Legacy path remains guarded and must be explicitly enabled:

```bash
ALLOW_LEGACY_DIRECT_SANITY=true npm run legacy:run:run1
```

Do not use legacy path for default production scheduling.

## Why legacy middleware/gunner remain disabled

- Legacy path bypasses the queue model.
- It mixes scraping with immediate transformation/publish-oriented behavior.
- New staged workers provide safer isolation, retries, and controlled throughput.
- Editorial placement is manual in Sanity; ingestion should not auto-apply homepage flags.
