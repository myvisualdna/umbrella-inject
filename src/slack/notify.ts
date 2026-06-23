import { logger } from "../config/logger";
import { getSlackConfigFromEnv, isSlackReady, redactWebhookUrl, type SlackConfig } from "./config";
import {
  buildAiSummaryMessage,
  buildFailureMessage,
  buildFetcherSummaryMessage,
  buildGunnerSummaryMessage,
} from "./messages";
import type {
  SlackAiSummary,
  SlackFailureAlert,
  SlackFetcherSummary,
  SlackGunnerSummary,
  SlackMessageContext,
  SlackWebhookPayload,
} from "./types";

const SLACK_REQUEST_TIMEOUT_MS = 10_000;

export type SlackNotifyDeps = {
  config?: SlackConfig;
  fetchImpl?: typeof fetch;
};

function buildMessageContext(config: SlackConfig): SlackMessageContext {
  return {
    channelName: config.channelName,
    githubRunUrl: config.githubRunUrl,
  };
}

export async function postSlackMessage(
  payload: SlackWebhookPayload,
  deps: SlackNotifyDeps = {}
): Promise<void> {
  const config = deps.config ?? getSlackConfigFromEnv();

  if (!config.enabled) {
    return;
  }

  if (!config.webhookUrl) {
    logger.warn("Slack enabled but SLACK_WEBHOOK_URL missing; skipping notification");
    return;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("Slack webhook returned non-2xx response", {
        status: response.status,
        webhook: redactWebhookUrl(config.webhookUrl),
      });
    }
  } catch (error) {
    logger.warn("Slack notification failed", {
      webhook: redactWebhookUrl(config.webhookUrl),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyFetcherSummary(
  summary: SlackFetcherSummary,
  deps: SlackNotifyDeps = {}
): Promise<void> {
  const config = deps.config ?? getSlackConfigFromEnv();
  if (!isSlackReady(config)) {
    if (config.enabled && !config.webhookUrl) {
      logger.warn("Slack enabled but SLACK_WEBHOOK_URL missing; skipping notification");
    }
    return;
  }

  const payload = buildFetcherSummaryMessage(summary, buildMessageContext(config));
  await postSlackMessage(payload, { ...deps, config });
}

export async function notifyAiSummary(
  summary: SlackAiSummary,
  deps: SlackNotifyDeps = {}
): Promise<void> {
  const config = deps.config ?? getSlackConfigFromEnv();
  if (!isSlackReady(config)) {
    if (config.enabled && !config.webhookUrl) {
      logger.warn("Slack enabled but SLACK_WEBHOOK_URL missing; skipping notification");
    }
    return;
  }

  const payload = buildAiSummaryMessage(summary, buildMessageContext(config));
  await postSlackMessage(payload, { ...deps, config });
}

export async function notifyGunnerSummary(
  summary: SlackGunnerSummary,
  deps: SlackNotifyDeps = {}
): Promise<void> {
  const config = deps.config ?? getSlackConfigFromEnv();
  if (!isSlackReady(config)) {
    if (config.enabled && !config.webhookUrl) {
      logger.warn("Slack enabled but SLACK_WEBHOOK_URL missing; skipping notification");
    }
    return;
  }

  const payload = buildGunnerSummaryMessage(summary, buildMessageContext(config));
  await postSlackMessage(payload, { ...deps, config });
}

export async function notifyFailure(
  alert: SlackFailureAlert,
  deps: SlackNotifyDeps = {}
): Promise<void> {
  const config = deps.config ?? getSlackConfigFromEnv();
  if (!isSlackReady(config)) {
    if (config.enabled && !config.webhookUrl) {
      logger.warn("Slack enabled but SLACK_WEBHOOK_URL missing; skipping notification");
    }
    return;
  }

  const payload = buildFailureMessage(alert, buildMessageContext(config));
  await postSlackMessage(payload, { ...deps, config });
}
