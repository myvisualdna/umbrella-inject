import type { SavedStoryCandidateRow } from "../db/storyCandidates";
import { escapeSlackMrkdwn } from "./messages";
import type { SlackStoryCandidateNotification, SlackWebhookPayload } from "./types";

export function toSlackStoryCandidateNotification(
  row: SavedStoryCandidateRow
): SlackStoryCandidateNotification {
  return {
    id: row.id,
    source_key: row.source_key,
    source_name: row.source_name,
    source_url: row.source_url,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    category: row.category,
    published_at: row.published_at,
    scraped_at: row.scraped_at,
    status: row.status,
    attempt_count: row.attempt_count,
    last_error: row.last_error,
    sanity_document_id: row.sanity_document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ingestion_batch_id: row.ingestion_batch_id,
    ingestion_run_id: row.ingestion_run_id,
  };
}

export function buildStoryCandidateSavedMessage(
  candidate: SlackStoryCandidateNotification
): SlackWebhookPayload {
  const titleLine = candidate.source_url
    ? `<${candidate.source_url}|${escapeSlackMrkdwn(candidate.title)}>`
    : escapeSlackMrkdwn(candidate.title);

  const jsonBlock = JSON.stringify(candidate, null, 2);
  const sectionText = [
    "*Saved article candidate*",
    `Title: ${titleLine}`,
    `Origin: ${escapeSlackMrkdwn(candidate.source_name)} (\`${escapeSlackMrkdwn(candidate.source_key)}\`)`,
    `Category: ${escapeSlackMrkdwn(candidate.category)}`,
    `Status: ${escapeSlackMrkdwn(candidate.status ?? "pending")}`,
    "",
    "```json",
    jsonBlock,
    "```",
  ].join("\n");

  return {
    text: `Saved article candidate: ${candidate.title}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: sectionText },
      },
    ],
  };
}
