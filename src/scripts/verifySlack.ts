/**
 * Offline Slack notification verification (no webhook calls, no network).
 */

import { getSlackConfigFromEnv, isSlackArticleNotificationsReady, isSlackReady, parsePositiveIntEnv, parseSlackBooleanEnv, redactWebhookUrl } from "../slack/config";
import {
  buildAiSummaryMessage,
  buildFailureMessage,
  buildFetcherSummaryMessage,
  buildGunnerSummaryMessage,
  buildInsertedArticlesSection,
  buildSanityStudioUrl,
  escapeSlackMrkdwn,
  formatFetcherArticleLine,
} from "../slack/messages";
import { notifyStoryCandidatesSaved } from "../slack/pipelineNotify";
import { postSlackMessage, notifyFetcherSummary } from "../slack/notify";
import { buildStoryCandidateSavedMessage, toSlackStoryCandidateNotification } from "../slack/storyCandidateSlack";
import type { SavedStoryCandidateRow } from "../db/storyCandidates";

const WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/secret-token";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testBooleanParsing(): void {
  assert(parseSlackBooleanEnv(undefined, false) === false, "undefined should use fallback");
  assert(parseSlackBooleanEnv("true", false) === true, "true should enable");
  assert(parseSlackBooleanEnv("TRUE", false) === true, "TRUE should enable");
  assert(parseSlackBooleanEnv("1", false) === true, "1 should enable");
  assert(parseSlackBooleanEnv("false", true) === false, "false should disable");
  assert(parseSlackBooleanEnv("0", true) === false, "0 should disable");
}

function testPositiveIntParsing(): void {
  assert(parsePositiveIntEnv(undefined, 10) === 10, "undefined should use fallback");
  assert(parsePositiveIntEnv("10", 5) === 10, "valid positive int should parse");
  assert(parsePositiveIntEnv("0", 10) === 10, "zero should use fallback");
  assert(parsePositiveIntEnv("-3", 10) === 10, "negative should use fallback");
  assert(parsePositiveIntEnv("abc", 10) === 10, "invalid should use fallback");
}

function makeSavedStoryCandidateRow(overrides: Partial<SavedStoryCandidateRow> = {}): SavedStoryCandidateRow {
  return {
    id: "uuid-1",
    source_key: "apNewsUS",
    source_name: "AP News US",
    source_url: "https://apnews.com/article/fed-rates",
    title: "Fed holds rates steady",
    excerpt: "The Fed left rates unchanged.",
    body: "Full article body text.",
    category: "us",
    published_at: "2026-06-19T12:00:00.000Z",
    scraped_at: "2026-06-19T12:05:00.000Z",
    status: "pending",
    attempt_count: 0,
    last_error: null,
    sanity_document_id: null,
    created_at: "2026-06-19T12:05:01.000Z",
    updated_at: "2026-06-19T12:05:01.000Z",
    ingestion_batch_id: "batch-abc",
    ingestion_run_id: "run1",
    ...overrides,
  };
}

async function testArticleNotificationsDisabledByDefault(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });
  assert(!config.articleNotificationsEnabled, "article notifications should be disabled by default");
  assert(!isSlackArticleNotificationsReady(config), "article notifications should not be ready by default");

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  await notifyStoryCandidatesSaved([makeSavedStoryCandidateRow()], { config, fetchImpl });
  assert(fetchCalls === 0, "disabled article notifications should not call fetch");
}

async function testArticleNotificationsEnabledPerRow(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_ARTICLE_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });
  assert(isSlackArticleNotificationsReady(config), "article notifications should be ready when enabled");

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  const rows = [
    makeSavedStoryCandidateRow({ id: "uuid-1", title: "Article One" }),
    makeSavedStoryCandidateRow({ id: "uuid-2", title: "Article Two", source_url: "https://example.com/two" }),
  ];

  await notifyStoryCandidatesSaved(rows, { config, fetchImpl });
  assert(fetchCalls === 2, "enabled article notifications should call fetch once per row");
}

async function testArticleNotificationsLimitCap(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_ARTICLE_NOTIFICATIONS_ENABLED: "true",
    SLACK_ARTICLE_NOTIFICATION_LIMIT: "10",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  const rows = Array.from({ length: 12 }, (_, index) =>
    makeSavedStoryCandidateRow({
      id: `uuid-${index + 1}`,
      source_url: `https://example.com/article-${index + 1}`,
      title: `Article ${index + 1}`,
    })
  );

  await notifyStoryCandidatesSaved(rows, { config, fetchImpl });
  assert(fetchCalls === 10, "article notifications should cap at limit of 10");
}

function testSerializerFullBodyAndExclusions(): void {
  const longBody = "x".repeat(5000);
  const row = makeSavedStoryCandidateRow({
    body: longBody,
    raw_payload: { secret: true },
    openai_response: { model: "gpt" },
    processed_payload: { draft: true },
  } as SavedStoryCandidateRow & {
    raw_payload?: unknown;
    openai_response?: unknown;
    processed_payload?: unknown;
  });

  const notification = toSlackStoryCandidateNotification(row);
  assert(notification.body === longBody, "serializer should include full body without truncation");
  assert(notification.id === "uuid-1", "serializer should include id");
  assert(notification.source_key === "apNewsUS", "serializer should include source_key");
  assert(notification.ingestion_batch_id === "batch-abc", "serializer should include ingestion_batch_id");

  const serialized = JSON.stringify(notification);
  assert(!serialized.includes("raw_payload"), "serializer should exclude raw_payload");
  assert(!serialized.includes("openai_response"), "serializer should exclude openai_response");
  assert(!serialized.includes("processed_payload"), "serializer should exclude processed_payload");
  assert(!serialized.includes("body_length"), "serializer should exclude body_length");
  assert(!serialized.includes("body_truncated"), "serializer should exclude body_truncated");
}

function testBuildStoryCandidateSavedMessageShape(): void {
  const payload = buildStoryCandidateSavedMessage(toSlackStoryCandidateNotification(makeSavedStoryCandidateRow()));
  const serialized = JSON.stringify(payload);

  assert(payload.text.includes("Fed holds rates steady"), "text fallback should include title");
  assert(serialized.includes("Saved article candidate"), "payload should include heading");
  assert(serialized.includes("AP News US"), "payload should include origin source name");
  assert(serialized.includes("apNewsUS"), "payload should include source key");
  assert(serialized.includes("```json"), "payload should include JSON code block");
  assert(serialized.includes("Full article body text."), "payload JSON should include body");
  assert(
    serialized.includes("<https://apnews.com/article/fed-rates|Fed holds rates steady>"),
    "payload should include Slack link for title"
  );
}

async function testArticleNotificationFetchFailureNoThrow(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_ARTICLE_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });

  const fetchImpl = async () => new Response("error", { status: 500 });
  await notifyStoryCandidatesSaved([makeSavedStoryCandidateRow()], { config, fetchImpl });
}

async function testConfigDisabledNoOp(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "false",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });
  assert(!isSlackReady(config), "disabled config should not be ready");

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  await postSlackMessage({ text: "noop" }, { config, fetchImpl });
  assert(fetchCalls === 0, "disabled config should not call fetch");
}

async function testMissingWebhookNoOp(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: "",
  });
  assert(!isSlackReady(config), "enabled without webhook should not be ready");

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  await postSlackMessage({ text: "noop" }, { config, fetchImpl });
  assert(fetchCalls === 0, "missing webhook should not call fetch");
}

function testFetcherMessageShape(): void {
  const payload = buildFetcherSummaryMessage(
    {
      runId: "run1",
      batchId: "batch-abc",
      insertedCount: 8,
      sourceCount: 6,
      skippedCount: 2,
      dryRun: false,
    },
    { githubRunUrl: "https://github.com/org/repo/actions/runs/123" }
  );

  const serialized = JSON.stringify(payload);
  assert(payload.text.includes("run1"), "fetcher text should include runId");
  assert(payload.text.includes("batch-abc"), "fetcher text should include batchId");
  assert(payload.text.includes("8"), "fetcher text should include inserted count");
  assert(serialized.includes("write"), "fetcher payload should include write mode");
  assert(serialized.includes("GitHub run"), "fetcher payload should include GitHub link");
}

function testFetcherInsertedArticlesMessage(): void {
  const payload = buildFetcherSummaryMessage({
    runId: "run1",
    batchId: "batch-abc",
    insertedCount: 5,
    dryRun: false,
    insertedArticles: [
      {
        title: "Fed holds rates steady",
        sourceName: "AP News US",
        sourceKey: "apNewsUS",
        sourceUrl: "https://apnews.com/article/fed-rates",
      },
      {
        title: "Senate passes bill",
        sourceName: "CBS US",
        sourceKey: "cbsUS",
        sourceUrl: "https://cbsnews.com/article/senate-bill",
      },
      {
        title: "Budget outlook shifts",
        sourceName: "Yahoo Finance",
        sourceKey: "yahooFinanceNews",
      },
    ],
    sourceBreakdown: "apNewsUS 2, cbsUS 1, yahooFinanceNews 1",
  });

  const serialized = JSON.stringify(payload);
  assert(serialized.includes("Inserted articles"), "fetcher payload should include inserted articles section");
  assert(serialized.includes("Fed holds rates steady"), "fetcher payload should include article title");
  assert(serialized.includes("apNewsUS"), "fetcher payload should include sourceKey");
  assert(serialized.includes("AP News US"), "fetcher payload should include sourceName");
  assert(
    serialized.includes("<https://apnews.com/article/fed-rates|Fed holds rates steady>"),
    "fetcher payload should include Slack link when sourceUrl exists"
  );
  assert(serialized.includes("Budget outlook shifts"), "fetcher payload should include title without URL");
  assert(!serialized.includes("<https://example.com|Budget outlook shifts>"), "missing URL should not create link");
  assert(serialized.includes("By source: apNewsUS 2, cbsUS 1, yahooFinanceNews 1"), "fetcher payload should include source breakdown");
}

function testFetcherInsertedArticlesCapAndOverflow(): void {
  const articles = Array.from({ length: 7 }, (_, index) => ({
    title: `Article ${index + 1}`,
    sourceKey: "techCrunch",
  }));

  const section = buildInsertedArticlesSection(articles);
  assert(section.includes("Article 1"), "section should include first article");
  assert(section.includes("Article 5"), "section should include fifth article");
  assert(!section.includes("Article 6"), "section should cap at 5 articles");
  assert(section.includes("+ 2 more"), "section should show overflow count");

  const payload = buildFetcherSummaryMessage({
    runId: "run1",
    batchId: "batch-abc",
    insertedCount: 7,
    dryRun: false,
    insertedArticles: articles,
  });
  assert(JSON.stringify(payload).includes("+ 2 more"), "fetcher payload should show + N more");
}

function testFetcherInsertedArticlesEmpty(): void {
  const payloadMissing = buildFetcherSummaryMessage({
    runId: "run1",
    batchId: "batch-abc",
    insertedCount: 0,
    dryRun: false,
  });
  const payloadEmpty = buildFetcherSummaryMessage({
    runId: "run1",
    batchId: "batch-abc",
    insertedCount: 0,
    dryRun: false,
    insertedArticles: [],
  });

  assert(
    !JSON.stringify(payloadMissing).includes("Inserted articles"),
    "missing insertedArticles should omit section"
  );
  assert(!JSON.stringify(payloadEmpty).includes("Inserted articles"), "empty insertedArticles should omit section");
}

function testFetcherArticlePipeInTitle(): void {
  const line = formatFetcherArticleLine({
    title: "A | B",
    sourceKey: "cbsUS",
    sourceUrl: "https://cbsnews.com/article/pipe-title",
  });

  assert(line.includes("│"), "pipe in title should be escaped for Slack link label");
  assert(!line.includes("|A | B>"), "raw pipe should not break Slack link syntax");
  assert(escapeSlackMrkdwn("Tom & Jerry <news>") === "Tom &amp; Jerry &lt;news&gt;", "mrkdwn escape should sanitize special chars");
}

function testFetcherArticleSourceKeyOnly(): void {
  const line = formatFetcherArticleLine({
    title: "Plain headline",
    sourceKey: "techCrunch",
  });

  assert(line.includes("`techCrunch`"), "sourceKey-only line should include key");
  assert(!line.includes(" —  — "), "sourceKey-only line should not include empty source name");
}

function testAiMessageShape(): void {
  const payload = buildAiSummaryMessage({
    runId: "999",
    batchId: "batch-ai",
    expectedCount: 10,
    processedCount: 9,
    failedCount: 1,
    provider: "mock",
    dryRun: true,
  });

  const serialized = JSON.stringify(payload);
  assert(serialized.includes("batch-ai"), "ai payload should include batchId");
  assert(serialized.includes("999"), "ai payload should include runId");
  assert(serialized.includes("mock"), "ai payload should include provider");
  assert(serialized.includes("9"), "ai payload should include processed count");
  assert(serialized.includes("dry-run"), "ai payload should include dry-run mode");
}

function testGunnerMessageShape(): void {
  const studioUrl = buildSanityStudioUrl("drafts.ingest-1", "https://angle.example.com/studio");
  assert(
    studioUrl === "https://angle.example.com/studio/structure/post;drafts.ingest-1",
    "studio URL should use structure path"
  );

  const payload = buildGunnerSummaryMessage({
    runId: "42",
    batchId: "batch-gunner",
    expectedCount: 5,
    draftCount: 4,
    failedCount: 1,
    dryRun: false,
    draftLinks: [
      { title: "Story One", sanityId: "drafts.ingest-1", studioUrl },
      { title: "Story Two", sanityId: "drafts.ingest-2" },
      { title: "Story Three", sanityId: "drafts.ingest-3" },
      { title: "Story Four", sanityId: "drafts.ingest-4" },
      { title: "Story Five", sanityId: "drafts.ingest-5" },
      { title: "Story Six", sanityId: "drafts.ingest-6" },
    ],
  });

  const serialized = JSON.stringify(payload);
  assert(serialized.includes("batch-gunner"), "gunner payload should include batchId");
  assert(serialized.includes("4"), "gunner payload should include draft count");
  assert(serialized.includes("Story One"), "gunner payload should include draft title");
  assert(serialized.includes("structure/post;drafts.ingest-1"), "gunner payload should include studio URL");
  assert(!serialized.includes("Story Six"), "gunner payload should cap draft links at 5");
}

function testFailureMessageShape(): void {
  const payload = buildFailureMessage({
    stage: "ai",
    runId: "run-x",
    batchId: "batch-fail",
    message: "Batch count mismatch",
    details: ["expectedCount=10", "reconcileTotal=8"],
  });

  const serialized = JSON.stringify(payload);
  assert(serialized.includes("ai"), "failure payload should include stage");
  assert(serialized.includes("Batch count mismatch"), "failure payload should include message");
  assert(serialized.includes("batch-fail"), "failure payload should include batchId");
  assert(serialized.includes("expectedCount=10"), "failure payload should include details");
}

async function testPostNon2xxNoThrow(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });

  const fetchImpl = async () => new Response("error", { status: 500 });
  await postSlackMessage({ text: "test" }, { config, fetchImpl });
}

function testWebhookRedaction(): void {
  const redacted = redactWebhookUrl(WEBHOOK_URL);
  assert(redacted !== WEBHOOK_URL, "redacted webhook should not equal full URL");
  assert(!redacted.includes("secret-token"), "redacted webhook should not include secret token");
  assert(redacted.includes("hooks.slack.com"), "redacted webhook should keep host");
}

async function testAwaitedNotifyDisabledNoThrow(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "false",
    SLACK_WEBHOOK_URL: WEBHOOK_URL,
  });

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  await notifyFetcherSummary(
    {
      runId: "run1",
      batchId: "batch-1",
      insertedCount: 1,
      dryRun: true,
    },
    { config, fetchImpl }
  );
  assert(fetchCalls === 0, "awaited notify when disabled should not call fetch");
}

async function testAwaitedNotifyMissingWebhookNoThrow(): Promise<void> {
  const config = getSlackConfigFromEnv({
    SLACK_NOTIFICATIONS_ENABLED: "true",
    SLACK_WEBHOOK_URL: "",
  });

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  await notifyFetcherSummary(
    {
      runId: "run1",
      batchId: "batch-1",
      insertedCount: 1,
      dryRun: true,
    },
    { config, fetchImpl }
  );
  assert(fetchCalls === 0, "awaited notify with missing webhook should not call fetch");
}

function testGunnerMessageWithoutStudioBaseUrl(): void {
  const payload = buildGunnerSummaryMessage({
    runId: "42",
    batchId: "batch-gunner",
    draftCount: 1,
    dryRun: false,
    draftLinks: [{ title: "Story One", sanityId: "drafts.ingest-1" }],
  });

  const serialized = JSON.stringify(payload);
  assert(serialized.includes("Story One"), "gunner payload should include draft title without studio base");
  assert(serialized.includes("drafts.ingest-1"), "gunner payload should include sanity id");
  assert(!serialized.includes("<http"), "gunner payload should not include broken studio links");
}

async function main(): Promise<void> {
  testBooleanParsing();
  testPositiveIntParsing();
  await testConfigDisabledNoOp();
  await testMissingWebhookNoOp();
  await testAwaitedNotifyDisabledNoThrow();
  await testAwaitedNotifyMissingWebhookNoThrow();
  await testArticleNotificationsDisabledByDefault();
  await testArticleNotificationsEnabledPerRow();
  await testArticleNotificationsLimitCap();
  testSerializerFullBodyAndExclusions();
  testBuildStoryCandidateSavedMessageShape();
  await testArticleNotificationFetchFailureNoThrow();
  testFetcherMessageShape();
  testFetcherInsertedArticlesMessage();
  testFetcherInsertedArticlesCapAndOverflow();
  testFetcherInsertedArticlesEmpty();
  testFetcherArticlePipeInTitle();
  testFetcherArticleSourceKeyOnly();
  testAiMessageShape();
  testGunnerMessageShape();
  testGunnerMessageWithoutStudioBaseUrl();
  testFailureMessageShape();
  await testPostNon2xxNoThrow();
  testWebhookRedaction();
  console.log("verifySlack: PASS");
}

main().catch((error) => {
  console.error("verifySlack: FAIL");
  console.error(error);
  process.exit(1);
});
