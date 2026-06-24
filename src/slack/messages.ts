import type {
  SlackAiSummary,
  SlackFailureAlert,
  SlackFetcherInsertedArticle,
  SlackFetcherSummary,
  SlackGunnerSummary,
  SlackMessageContext,
  SlackWebhookPayload,
} from "./types";

type SlackBlock = Record<string, unknown>;

const MAX_FETCHER_INSERTED_ARTICLES = 5;

function formatBatchId(batchId: string | null | undefined): string {
  return batchId ?? "none";
}

function formatRunId(runId: string | undefined): string {
  return runId?.trim() ? runId : "—";
}

function formatMode(dryRun: boolean): string {
  return dryRun ? "dry-run" : "write";
}

function fieldBlock(label: string, value: string): SlackBlock {
  return {
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*${label}:*\n${value}` },
    ],
  };
}

function twoFieldBlock(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string): SlackBlock {
  return {
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*${leftLabel}:*\n${leftValue}` },
      { type: "mrkdwn", text: `*${rightLabel}:*\n${rightValue}` },
    ],
  };
}

function appendContextBlocks(blocks: SlackBlock[], context: SlackMessageContext | undefined): void {
  const elements: Array<{ type: string; text: string }> = [];

  if (context?.channelName) {
    elements.push({ type: "mrkdwn", text: `Channel: ${context.channelName}` });
  }
  if (context?.githubRunUrl) {
    elements.push({
      type: "mrkdwn",
      text: `<${context.githubRunUrl}|GitHub run>`,
    });
  }

  if (elements.length > 0) {
    blocks.push({ type: "context", elements });
  }
}

export function buildSanityStudioUrl(
  documentId: string,
  studioBaseUrl?: string
): string | undefined {
  const base = studioBaseUrl?.trim().replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/structure/post;${documentId}`;
}

export function escapeSlackMrkdwn(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "│");
}

function formatFetcherArticleSourceSuffix(article: SlackFetcherInsertedArticle): string {
  const sourceKey = article.sourceKey?.trim();
  const sourceName = article.sourceName?.trim();

  if (sourceName && sourceKey) {
    return ` — ${escapeSlackMrkdwn(sourceName)} (\`${sourceKey}\`)`;
  }
  if (sourceKey) {
    return ` — \`${sourceKey}\``;
  }
  return "";
}

export function formatFetcherArticleLine(article: SlackFetcherInsertedArticle): string {
  const title = article.title?.trim() || "Untitled";
  const escapedTitle = escapeSlackMrkdwn(title);
  const sourceUrl = article.sourceUrl?.trim();
  const sourceSuffix = formatFetcherArticleSourceSuffix(article);
  const titleText = sourceUrl ? `<${sourceUrl}|${escapedTitle}>` : escapedTitle;
  return `• ${titleText}${sourceSuffix}`;
}

export function buildInsertedArticlesSection(articles: SlackFetcherInsertedArticle[]): string {
  const preview = articles.slice(0, MAX_FETCHER_INSERTED_ARTICLES);
  const lines = preview.map((article) => formatFetcherArticleLine(article));
  const remaining = articles.length - preview.length;
  if (remaining > 0) {
    lines.push(`+ ${remaining} more`);
  }
  return lines.join("\n");
}

export function buildFetcherSummaryMessage(
  summary: SlackFetcherSummary,
  context?: SlackMessageContext
): SlackWebhookPayload {
  const runId = formatRunId(summary.runId);
  const batchId = formatBatchId(summary.batchId);
  const mode = formatMode(summary.dryRun);
  const insertedArticles = summary.insertedArticles ?? [];
  const firstTitle = insertedArticles[0]?.title?.trim();
  const text = firstTitle
    ? `Fetcher complete — ${runId} batch ${batchId}: ${summary.insertedCount} inserted (${mode}); ${firstTitle}`
    : `Fetcher complete — ${runId} batch ${batchId}: ${summary.insertedCount} inserted (${mode})`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Fetcher Worker complete*\nRun: \`${runId}\` | Batch: \`${batchId}\``,
      },
    },
    twoFieldBlock("Inserted", String(summary.insertedCount), "Mode", mode),
  ];

  if (summary.sourceCount !== undefined || summary.skippedCount !== undefined) {
    blocks.push(
      twoFieldBlock(
        "Sources",
        summary.sourceCount !== undefined ? String(summary.sourceCount) : "n/a",
        "Skipped",
        summary.skippedCount !== undefined ? String(summary.skippedCount) : "n/a"
      )
    );
  }

  if (summary.failedCount !== undefined) {
    blocks.push(fieldBlock("Failed", String(summary.failedCount)));
  }

  if (insertedArticles.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Inserted articles*\n${buildInsertedArticlesSection(insertedArticles)}`,
      },
    });
  }

  if (summary.sourceBreakdown) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `By source: ${summary.sourceBreakdown}` }],
    });
  }

  appendContextBlocks(blocks, context);
  return { text, blocks };
}

export function buildAiSummaryMessage(
  summary: SlackAiSummary,
  context?: SlackMessageContext
): SlackWebhookPayload {
  const runId = formatRunId(summary.runId);
  const batchId = formatBatchId(summary.batchId);
  const mode = formatMode(summary.dryRun);
  const expected = summary.expectedCount !== undefined ? String(summary.expectedCount) : "n/a";
  const failed = summary.failedCount !== undefined ? String(summary.failedCount) : "0";
  const text = `AI complete — ${runId} batch ${batchId}: ${summary.processedCount} processed (${summary.provider}, ${mode})`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*AI Worker complete*\nRun: \`${runId}\` | Batch: \`${batchId}\``,
      },
    },
    twoFieldBlock("Processed", String(summary.processedCount), "Provider", summary.provider),
    twoFieldBlock("Expected", expected, "Failed", failed),
    fieldBlock("Mode", mode),
  ];

  appendContextBlocks(blocks, context);
  return { text, blocks };
}

export function buildGunnerSummaryMessage(
  summary: SlackGunnerSummary,
  context?: SlackMessageContext
): SlackWebhookPayload {
  const runId = formatRunId(summary.runId);
  const batchId = formatBatchId(summary.batchId);
  const mode = formatMode(summary.dryRun);
  const expected = summary.expectedCount !== undefined ? String(summary.expectedCount) : "n/a";
  const failed = summary.failedCount !== undefined ? String(summary.failedCount) : "0";
  const text = `Gunner complete — ${runId} batch ${batchId}: ${summary.draftCount} drafts (${mode})`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Gunner Worker complete*\nRun: \`${runId}\` | Batch: \`${batchId}\``,
      },
    },
    twoFieldBlock("Drafts", String(summary.draftCount), "Expected", expected),
    twoFieldBlock("Failed", failed, "Mode", mode),
  ];

  const draftLinks = (summary.draftLinks ?? []).slice(0, 5);
  if (draftLinks.length > 0) {
    const linkLines = draftLinks.map((draft) => {
      if (draft.studioUrl) {
        return `• <${draft.studioUrl}|${draft.title}> (\`${draft.sanityId}\`)`;
      }
      return `• ${draft.title} (\`${draft.sanityId}\`)`;
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Draft links*\n${linkLines.join("\n")}`,
      },
    });
  }

  appendContextBlocks(blocks, context);
  return { text, blocks };
}

export function buildFailureMessage(
  alert: SlackFailureAlert,
  context?: SlackMessageContext
): SlackWebhookPayload {
  const runId = formatRunId(alert.runId);
  const batchId = formatBatchId(alert.batchId);
  const text = `${alert.stage} failure — ${alert.message}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Pipeline failure: ${alert.stage}*\n${alert.message}`,
      },
    },
    twoFieldBlock("Run", runId, "Batch", batchId),
  ];

  if (alert.details && alert.details.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Details*\n${alert.details.map((detail) => `• ${detail}`).join("\n")}`,
      },
    });
  }

  appendContextBlocks(blocks, context);
  return { text, blocks };
}
