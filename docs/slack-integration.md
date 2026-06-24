# Slack Integration (Milestone 1)

Milestone 1 adds **notification-only** Slack integration for the ingestion pipeline. Messages are posted via Slack Incoming Webhooks when workers complete or when validation failures occur.

## Scope (Milestone 1)

Included:

- Pipeline summary notifications for Fetcher, AI, and Gunner workers
- Failure alerts for batch validation mismatches and unhandled worker errors
- Optional GitHub Actions run links in messages
- Optional Sanity Studio links for up to 5 created drafts (Gunner)

Not included (future milestones):

- Slack slash commands
- Slack buttons, modals, or interactive endpoints
- Publish actions from Slack
- Sanity publish from Slack
- Story candidate creation from Slack
- User authorization logic
- Slack audit table

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SLACK_NOTIFICATIONS_ENABLED` | No | `false` | Master switch (`true`/`false`/`1`/`0`) |
| `SLACK_WEBHOOK_URL` | When enabled | — | Slack Incoming Webhook URL (secret) |
| `SLACK_CHANNEL_NAME` | No | — | Display-only channel label in messages |
| `ANGLE_STUDIO_BASE_URL` | No | — | Base URL for Sanity Studio draft links |
| `ANGLE_SITE_BASE_URL` | No | — | Reserved for future site links |
| `GITHUB_RUN_URL` | No | — | Link to the GitHub Actions run |
| `SLACK_ARTICLE_NOTIFICATIONS_ENABLED` | No | `false` | Send per-article JSON messages after Fetcher summary |
| `SLACK_ARTICLE_NOTIFICATION_LIMIT` | No | `10` | Max per-article Slack messages per Fetcher run |

Example `.env` (local):

```bash
SLACK_NOTIFICATIONS_ENABLED=false
SLACK_WEBHOOK_URL=
SLACK_CHANNEL_NAME=#angle-pipeline
SLACK_ARTICLE_NOTIFICATIONS_ENABLED=false
SLACK_ARTICLE_NOTIFICATION_LIMIT=10
ANGLE_STUDIO_BASE_URL=https://your-site.com/studio
ANGLE_SITE_BASE_URL=https://your-site.com
GITHUB_RUN_URL=
```

## Creating a Slack Incoming Webhook

1. In Slack, open **Apps** and add **Incoming Webhooks** (or create via a Slack app).
2. Enable incoming webhooks and add a webhook to your target channel.
3. Copy the webhook URL into `SLACK_WEBHOOK_URL` (store as a secret in CI).
4. Set `SLACK_NOTIFICATIONS_ENABLED=true` when you want notifications.

The webhook URL determines the destination channel. `SLACK_CHANNEL_NAME` is only shown in message context for readability.

## Events notified

| Event | Stage | When |
| --- | --- | --- |
| Fetcher summary | `fetcher` | After audit report is written |
| Fetcher per-article JSON | `fetcher` | After summary, when `SLACK_ARTICLE_NOTIFICATIONS_ENABLED=true` (up to limit) |
| AI summary | `ai` | After AI worker outputs are written |
| Gunner summary | `gunner` | After Gunner outputs are written (includes up to 5 Studio links) |
| Batch validation failure | `ai` / `gunner` | Strict batch count reconciliation fails |
| Unhandled worker error | `fetcher` / `ai` / `gunner` | Worker throws before normal completion |

## Safety behavior

- **`SLACK_NOTIFICATIONS_ENABLED=false` (default):** Slack code is a no-op. Pipeline behavior is unchanged.
- **Enabled but missing webhook:** A warning is logged; the pipeline continues. The webhook URL is never logged in full.
- **Webhook errors (non-2xx, timeout, network):** Logged as warnings; the pipeline is not failed.
- **No secrets in logs:** Webhook URLs are redacted in log output.

## Per-article Fetcher notifications (optional)

When `SLACK_ARTICLE_NOTIFICATIONS_ENABLED=true` (and the master Slack switch + webhook are set), the Fetcher sends one Slack message per newly inserted `story_candidates` row after the batch summary. Messages include schema-accurate JSON with the full `body` (no truncation). Internal fields (`raw_payload`, `openai_response`, `processed_payload`) are never included.

- Default: **off** (`SLACK_ARTICLE_NOTIFICATIONS_ENABLED=false`)
- Default limit: **10** messages per run (`SLACK_ARTICLE_NOTIFICATION_LIMIT`)
- Summary notification remains the primary signal; per-article messages are noisy and intended for debugging or monitoring
- Very long article bodies may exceed Slack block size limits; failures are logged and non-fatal

Enable in GitHub Actions by setting repository variables `SLACK_ARTICLE_NOTIFICATIONS_ENABLED` and optionally `SLACK_ARTICLE_NOTIFICATION_LIMIT` on fetcher workflows only.

## Verification

Offline verification (no Slack, no OpenAI, no Gunner writes):

```bash
npm run slack:verify
```

## GitHub Actions (optional)

Workflows can pass a run link without enabling Slack:

```yaml
env:
  GITHUB_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

To enable Slack in CI, also set `SLACK_NOTIFICATIONS_ENABLED=true` and provide `SLACK_WEBHOOK_URL` from secrets. Milestone 1 does not enable Slack in workflows by default.

## Module layout

- [`src/slack/config.ts`](../src/slack/config.ts) — env parsing
- [`src/slack/types.ts`](../src/slack/types.ts) — payload types
- [`src/slack/messages.ts`](../src/slack/messages.ts) — Block Kit message builders (pure)
- [`src/slack/storyCandidateSlack.ts`](../src/slack/storyCandidateSlack.ts) — per-article JSON serializer and message builder
- [`src/slack/notify.ts`](../src/slack/notify.ts) — webhook POST (optional)
- [`src/slack/pipelineNotify.ts`](../src/slack/pipelineNotify.ts) — worker adapters

## Studio draft links

When `ANGLE_STUDIO_BASE_URL` is set, Gunner summaries include links in this form:

```
{ANGLE_STUDIO_BASE_URL}/structure/post;{sanityDocumentId}
```

Example: `https://angle.example.com/studio/structure/post;drafts.ingest-abc123`
