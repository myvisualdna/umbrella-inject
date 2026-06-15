# Step 2: Supabase Story Candidates Queue

This step persists normalized story candidates into Supabase as an internal
queue for downstream processing.

Current workflow:

```text
scrape
-> normalize
-> insert into story_candidates (status=pending)
```

## What this table does

`story_candidates` stores validated, deduplicated normalized candidates from
`audit-output/normalized/story-candidates.json` with ingestion metadata:

- source fields (`source_key`, `source_name`, `source_url`)
- content fields (`title`, `excerpt`, `body`, `category`)
- timestamps (`published_at`, `scraped_at`, `created_at`, `updated_at`)
- queue state (`status`, `attempt_count`, `last_error`)
- payload fields (`raw_payload`, future processing fields)

The table uses a unique index on `source_url` to guarantee idempotency.

## Step 2.5: Status lifecycle

The queue now includes an intermediate `processed` status for the future AI worker.

Intended lifecycle:

```text
pending -> processing -> processed -> draft_created
```

- `pending`: Candidate is waiting for AI processing.
- `processing`: Candidate is currently being transformed by the AI worker.
- `processed`: AI output exists in `processed_payload`, but no Sanity draft has been created yet.
- `draft_created`: Sanity draft exists and `sanity_document_id` is stored.
- `failed`: Processing failed and should be retried or inspected.
- `rejected`: Candidate was intentionally rejected.
- `skipped_duplicate`: Candidate was intentionally skipped as a duplicate.

## Required environment variables

Set these in the `news-ingestion` runtime environment:

- `SUPABASE_URL` (preferred)
- `SUPABASE_SERVICE_ROLE_KEY`

Fallback URL env vars are supported for compatibility:

- `NEXT_PUBLIC_SUPABASE_PROJECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`

Optional:

- `INGESTION_ENABLED_SOURCE_KEYS` (comma-separated source keys)

Example:

```bash
INGESTION_ENABLED_SOURCE_KEYS=cbsUS,cbsWorld,cbsPolitics,techCrunch,abcNewsUS,abcNewsInternational,abcNewsBusiness,abcNewsTechnology
```

If unset, all normalized sources are eligible.

## Commands

Dry run (default, no writes):

```bash
npm run candidates:dry-run
```

Insert mode (writes to Supabase):

```bash
npm run candidates:insert
```

Pure function verification:

```bash
npm run candidates:verify
```

## Validation before insert

A candidate is inserted only if:

- `success === true`
- `sourceKey` exists and is known
- `sourceName` exists
- `sourceUrl` is a valid URL
- `title` has at least 4 chars
- `body` exists and has at least 150 words
- `category` exists
- `scrapedAt` exists

Invalid records are skipped and reported.

## Deduplication and idempotency

- DB-level dedupe key: `source_url` unique index.
- Inserts use conflict-safe upsert with duplicates ignored.
- Running `npm run candidates:insert` twice is safe:
  - First run inserts new rows.
  - Second run inserts zero and reports duplicates.
  - Existing rows are not overwritten.

## Generated reports

Each run writes:

- `audit-output/supabase-insert/summary.json`
- `audit-output/supabase-insert/INSERT_AUDIT.md`

These include inserted count, duplicates, allowlist skips, validation rejections,
and failures.

## Not included in Step 2

- No OpenAI calls
- No Sanity writes
- No publishing
- No AI worker implementation
- No Slack integration
