# Step 3: AI Worker (pending to processed)

This step reads pending `story_candidates` from Supabase, generates a
structured article draft payload, validates it, and writes the result back to
the same row, advancing its status.

```text
pending
-> processing
-> processed
```

Step 3 stops at `processed`. Creating Sanity drafts (`draft_created`) and
publishing belong to later steps.

## What the AI worker does

For each selected candidate the worker:

1. Claims the candidate (`pending -> processing`, increments `attempt_count`).
2. Sends the candidate's title/excerpt/body/category/source to the AI provider.
3. Receives a structured `ProcessedArticlePayload` (plain-text paragraphs, not
   Portable Text).
4. Validates the payload against a JSON schema plus business rules.
5. On success: writes `processed_payload`, `openai_response`, sets
   `status = processed`. On failure: writes `last_error`, sets
   `status = failed`.

The worker never calls Sanity, never creates drafts, and never publishes.

## Tag catalog enforcement (`tagSlugs`)

Step 3 uses canonical `tagSlugs` instead of free-text tags.

Tags are **category-scoped**: every tag belongs to exactly one parent category
in Sanity (`tag.category -> category`).

- The worker loads the current Sanity tag catalog from local cache.
- For each candidate, only tags belonging to the candidate's category are
  passed to the prompt and JSON schema.
- Unknown slugs or slugs from another category are rejected by validation.
- If the category has no valid tags yet, the model receives an empty allowed
  list and should return `tagSlugs: []`.

Milestone 2 reseeds categories and tags via `npm run taxonomy:reseed` (see
[`docs/taxonomy.md`](taxonomy.md)). Milestone 3 reseeds articles against this
taxonomy via `npm run milestone3:reseed` (see [`docs/articles-seed.md`](articles-seed.md)).

## Providers

The provider is selected by `AI_PROVIDER` and abstracted behind
`AiArticleProvider` (`src/ai/types.ts`).

### Mock mode (default)

- `AI_PROVIDER=mock` (or unset).
- No external API call. Deterministic output derived from the candidate.
- Always sets `editorialNotes.humanReviewRequired = true` and tags the result
  with `mock-output`.
- `openai_response` is populated with mock provider metadata
  (`provider: "mock"`, `model: null`).
- Mock provider emits only valid category-scoped `tagSlugs` (or `[]` if the
  category has no tags in cache).

### Dry-run mode

- `AI_DRY_RUN=true` or the `--dry-run` flag.
- Reads pending candidates and generates + validates payloads, but performs
  **no Supabase writes** (no claim, no status change).
- Writes preview artifacts only.

### Real OpenAI mode

- `AI_PROVIDER=openai`. Requires `OPENAI_API_KEY`.
- Uses the official `openai` SDK with Structured Outputs
  (`response_format: json_schema`, `strict: true`) so the model adheres to the
  payload schema.
- Model from `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
- The API key is never logged or persisted. `openai_response` stores only
  metadata (id, model, finish reason, token usage).
- If `AI_PROVIDER=openai` and no key is present, the worker fails fast before
  claiming any candidate.

OpenAI is never called by default and is not exercised during normal
verification.

## Required environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `SUPABASE_URL` | Ingestion Supabase project URL | required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side writes | required |
| `AI_PROVIDER` | `mock` or `openai` | `mock` |
| `AI_PROCESS_LIMIT` | Candidates per run | `1` |
| `AI_DRY_RUN` | `true` to preview without writes | `false` |
| `AI_SOURCE_KEYS` | Comma-separated source-key allowlist | none |
| `AI_ALLOW_LARGE_BATCH` | `true` to allow limit > 5 | `false` |
| `OPENAI_API_KEY` | Required only when `AI_PROVIDER=openai` | none |
| `OPENAI_MODEL` | Model id for OpenAI provider | `gpt-4o-mini` |

## Commands

```bash
# Type check
npx tsc --noEmit

# Unit-style verification (no DB, no network)
npm run ai:verify

# Dry-run: read + generate + validate, no Supabase writes
AI_PROVIDER=mock AI_DRY_RUN=true AI_PROCESS_LIMIT=1 npm run ai:process-pending:dry-run

# Process exactly one candidate with the mock provider (writes to Supabase)
AI_PROVIDER=mock AI_PROCESS_LIMIT=1 npm run ai:process-pending
```

## How to verify Supabase updates

After a real mock run, inspect the processed row:

```sql
select id, status, attempt_count,
       processed_payload is not null as has_payload,
       openai_response->>'provider' as openai_provider,
       last_error, sanity_document_id
from public.story_candidates
where status = 'processed'
order by updated_at desc
limit 1;
```

Expected after processing one candidate:

- `status` moved from `pending` to `processed`
- `attempt_count` incremented by 1
- `processed_payload` populated
- `openai_response` populated (provider `mock` during mock runs)
- `last_error` is null
- `sanity_document_id` remains null (no Sanity activity)
- `title`, `body`, `source_url`, and `raw_payload` unchanged
- `processed_payload.tagSlugs` contains only allowed slugs for the candidate
  category (or `[]`)

## Fields the worker updates

The worker only writes:

- `status`
- `attempt_count`
- `last_error`
- `processed_payload`
- `openai_response`

It never overwrites source/content fields (`title`, `excerpt`, `body`,
`category`, `source_*`) or `raw_payload`.

## Safety protections

- Default provider is `mock`; OpenAI requires an explicit flag and key.
- Default limit is 1; limits above 5 require `AI_ALLOW_LARGE_BATCH=true`.
- Claims are status-guarded (`update ... where status='pending'`) so two
  workers cannot process the same row.
- `processed` and `draft_created` rows are never re-selected (only `pending`
  rows are claimed).
- No Sanity writes, no draft creation, no publishing.

## Output artifacts

Each run writes to `audit-output/ai-worker/`:

- `summary.json` - provider, dry-run, counts, candidate IDs, source keys,
  whether Supabase was updated, whether OpenAI was called.
- `AI_WORKER_AUDIT.md` - human-readable report.
- `processed-preview.json` - generated payloads and validation results.

## Recovering stuck candidates

`resetStaleProcessingCandidates({ olderThanMinutes })` returns rows left in
`processing` (e.g. after a crash) back to `pending` for retry.

## How Step 4 will consume `processed_payload`

Step 4 (Sanity draft creation) will read `processed` rows and map
`processed_payload` into a Sanity document:

- `body` (plain paragraphs) will be converted to Portable Text.
- `title`, `tickerTitle`, `excerpt`, `tagSlugs`, `seo`, and `category` map to the
  Sanity article fields.
- `classification` and `editorialNotes` inform editorial review and routing
  (`humanReviewRequired` is always true for now).
- On draft creation, Step 4 sets `sanity_document_id` and advances
  `status` to `draft_created`.
