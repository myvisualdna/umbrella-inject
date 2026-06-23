export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string | undefined;
  channelName: string | undefined;
  studioBaseUrl: string | undefined;
  siteBaseUrl: string | undefined;
  githubRunUrl: string | undefined;
}

function parseOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseSlackBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

export function getSlackConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SlackConfig {
  return {
    enabled: parseSlackBooleanEnv(env.SLACK_NOTIFICATIONS_ENABLED, false),
    webhookUrl: parseOptionalString(env.SLACK_WEBHOOK_URL),
    channelName: parseOptionalString(env.SLACK_CHANNEL_NAME),
    studioBaseUrl: parseOptionalString(env.ANGLE_STUDIO_BASE_URL),
    siteBaseUrl: parseOptionalString(env.ANGLE_SITE_BASE_URL),
    githubRunUrl: parseOptionalString(env.GITHUB_RUN_URL),
  };
}

export function isSlackReady(config: SlackConfig): boolean {
  return config.enabled && Boolean(config.webhookUrl);
}

export function redactWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) {
      return `${parsed.origin}/***`;
    }
    const redactedPath = pathParts.map((part, index) =>
      index === pathParts.length - 1 ? "***" : part
    );
    return `${parsed.origin}/${redactedPath.join("/")}`;
  } catch {
    return "***";
  }
}
