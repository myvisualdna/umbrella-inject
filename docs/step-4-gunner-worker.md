# Step 4: Gunner Worker (`processed` → `draft_created`)

The Gunner Worker is the fourth stage of the Angle ingestion pipeline:

```
scrape → normalize → Supabase story_candidates (pending)
       → AI worker (processed)  ← Step 3
       → Gunner worker (draft_created)  ← Step 4 (this doc)
       → (future) human review / publish
```

It reads `processed` candidates from Supabase, maps each `processed_payload`
into the current Angle Sanity `post` schema, creates a **draft-only** document,
then updates Supabase with the `sanity_document_id` and `status = "draft_created"`.

It never calls OpenAI, never runs the AI worker, and never publishes.

## Cache refresh before processing

Before candidate mapping, the worker refreshes local Sanity caches by default:

- categories
- tags
- authors

This avoids stale-reference failures when Sanity IDs rotate.

- Default behavior: `GUNNER_REFRESH_SANITY_CACHE=true`
- Disable only for offline testing: `GUNNER_REFRESH_SANITY_CACHE=false`

Startup logs include a non-sensitive summary: project id, dataset, and loaded
counts for categories/tags/authors. No token values are printed.

## What it does

For each selected candidate (`status = 'processed'`, oldest first):

1. Re-validates the stored `processed_payload` against the Step 3 contract.
2. Maps it to a Sanity `post` draft (`mapProcessedPayloadToSanityDraft`):
   - deterministic `_id` = `drafts.ingest-{candidateId}`
   - `status: "draft"`
   - body as Portable Text under `body`
   - `seo` (`_type: "seo"`)
   - category/tag references resolved from refreshed local caches
   - tags come from `processed_payload.tagSlugs` (legacy `tags` fallback only for transition)
   - always includes a branded placeholder `cover` for editorial replacement
3. Validates the mapped draft (`validateSanityDraftPayload`) — rejects anything
   that looks published or carries legacy/homepage fields.
4. **Dry-run:** writes a preview and stops (no Sanity, no Supabase).
   **Write mode:** `createIfNotExists(drafts.ingest-{id})` then
   `markCandidateDraftCreated`.

## How it differs from the legacy `src/gunner/*` pipeline

The legacy gunner (still wired into `scrapingRunner.ts`, untouched here) was
unsafe for this workflow. The new worker lives in `src/gunnerWorker/` and:

| Concern            | Legacy gunner                              | Gunner Worker (Step 4)                     |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| Document status    | `status: "published"`                      | `status: "draft"` only                     |
| `publishedAt`      | set                                        | never set                                  |
| Body field         | `bodyTextOne`                              | `body` (Portable Text)                     |
| Write strategy     | `createOrReplace`                          | `createIfNotExists` (overwrite opt-in)     |
| Document id        | live/published id                          | `drafts.ingest-{candidateId}`              |
| Homepage/editorial | rails + flags toggled                      | all flags forced `false`                   |
| Author / readTime  | random                                     | none (unless `GUNNER_DEFAULT_AUTHOR_ID`)   |
| Source of data     | reads scraped JSON from disk               | reads `processed_payload` from Supabase    |

The new worker **reuses** only the safe, read-only legacy pieces:
`getSanityClient()`, Sanity env/config, and the category/tag cache resolvers.

## Commands

```bash
# Type-check
npx tsc --noEmit

# Offline assertions (no network)
npm run gunner:verify

# Dry-run: preview only, no Sanity writes, no Supabase changes
npm run gunner:create-drafts:dry-run

# Write one real draft (requires a valid Sanity write token)
GUNNER_WRITE_ENABLED=true GUNNER_LIMIT=1 npm run gunner:create-drafts
```

## Environment variables

| Variable                   | Default | Purpose                                                        |
| -------------------------- | ------- | -------------------------------------------------------------- |
| `GUNNER_WRITE_ENABLED`     | `false` | Must be `true` to write to Sanity / Supabase. Otherwise dry-run. |
| `GUNNER_LIMIT`             | `1`     | Max candidates per run. >5 requires `GUNNER_ALLOW_LARGE_BATCH`.  |
| `GUNNER_SOURCE_KEYS`       | (none)  | Comma-separated source-key filter.                              |
| `GUNNER_CANDIDATE_ID`      | (none)  | Process exactly one specific candidate id.                       |
| `GUNNER_OVERWRITE_DRAFT`   | `false` | Use `createOrReplace` instead of `createIfNotExists`.           |
| `GUNNER_REFRESH_SANITY_CACHE` | `true` | Refresh category/tag/author caches at startup.               |
| `GUNNER_DEFAULT_AUTHOR_ID` | (none)  | If set, attach this author reference to the draft.              |
| `GUNNER_PLACEHOLDER_COVER_SOURCE` | `external` | Placeholder cover source.                         |
| `GUNNER_PLACEHOLDER_COVER_URL` | built-in placeholder URL | Placeholder cover URL.                    |
| `GUNNER_PLACEHOLDER_COVER_ALT` | default text | Alt text marking placeholder for replacement.       |
| `GUNNER_PLACEHOLDER_COVER_CAPTION` | default text | Caption reminding editor to replace.        |
| `GUNNER_PLACEHOLDER_COVER_CREDIT_AUTHOR` | `Angle` | Placeholder credit author.                  |
| `GUNNER_PLACEHOLDER_COVER_CREDIT_SOURCE` | `Angle` | Placeholder credit source.                  |
| `GUNNER_PLACEHOLDER_COVER_LICENSE_OR_RIGHTS` | default text | Placeholder rights note.       |
| `GUNNER_ALLOW_LARGE_BATCH` | `false` | Allow `GUNNER_LIMIT > 5`.                                       |
| `SANITY_API_WRITE_TOKEN`   | —       | Sanity write token (used by `getSanityClient`).                 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase access.                            |

`--dry-run` (CLI flag) also forces dry-run regardless of `GUNNER_WRITE_ENABLED`.

## Fields the draft sets

- `_id` (`drafts.ingest-{candidateId}`), `_type: "post"`, `status: "draft"`
- `title`, `tickerTitle` (≤ 40), `excerpt` (≤ 280), `slug`
- `category` (reference), `tags` (resolved from `tagSlugs`; omitted if none resolve)
- `body` (Portable Text blocks), `seo` (`_type: "seo"`)
- `readTime` (estimated at ~200 wpm)
- `cover` placeholder (`_type: "coverMedia"`, `source: "external"`, `externalUrl`,
  `alt`, `caption`, `creditAuthor`, `creditSource`, `licenseOrRights`)
- homepage/editorial booleans, all explicitly `false`

## Fields the draft NEVER sets

`publishedAt`, `bodyTextOne`, `date`, `priority`, `labels`, any `*Rank`,
any `*Until`, and any enabled homepage/editorial flag. The draft validator
rejects the document if any of these appear.

## Supabase transition

On a successful write (status-guarded `.eq('status','processed')`):

- `status`: `processed` → `draft_created`
- `sanity_document_id`: set to the draft `_id`
- `last_error`: cleared
- `processed_payload` / `raw_payload` / source fields: untouched

On failure, `markCandidateGunnerFailed` records `last_error` and leaves
`status = processed` so the candidate can be retried on a later run.

## Editorial replacement policy (image/author)

Gunner intentionally creates a placeholder cover for every draft so the document
is valid in Sanity and clearly marked for editorial review.

- AI Worker does not pick images, credits, or cover URLs.
- Gunner does not auto-promote scraped images to final cover.
- Editors must replace placeholder image/caption/credits before publishing.
- If `GUNNER_DEFAULT_AUTHOR_ID` is set, Gunner validates the id exists before write.
- If no default author is configured, author is omitted on `post` drafts and a
  review warning is added to artifacts.

## Inspecting a created draft

Drafts live in Sanity project `hxfedc5p`, dataset `production`. A draft id has
the form `drafts.ingest-{candidateId}`. It appears in Sanity Studio under the
post's draft/unpublished state and is **not** on the public site (no published
document is created). You can also verify the Supabase row:

```sql
select id, status, sanity_document_id
from story_candidates
where id = '{candidateId}';
```

## Output artifacts

Written to `audit-output/gunner-worker/`:

- `summary.json` — run config, counts, per-candidate outcomes, safety flags.
- `GUNNER_WORKER_AUDIT.md` — human-readable summary.
- `sanity-draft-preview.json` — the exact draft document(s) that would be / were written.

## Step 5 outlook

Step 5 will add human review / Slack notification and the eventual
draft → publish promotion. That promotion is intentionally out of scope here:
this worker stops at `draft_created` and never publishes.
