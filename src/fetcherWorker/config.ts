import type { SourceKey } from "../config/scrapingControl";
import type { FetcherRunOptions } from "./types";

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

function parseOptionalPositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseFetcherSourceKeys(raw?: string): Set<SourceKey> | null {
  if (!raw) return null;

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is SourceKey => value.length > 0);

  if (values.length === 0) return null;
  return new Set(values);
}

export function getFetcherRunIdFromEnv(): string | null {
  const value = process.env.FETCHER_RUN_ID?.trim();
  return value ? value : null;
}

export function getFetcherRunOptionsFromEnv(): FetcherRunOptions {
  return {
    dryRun: parseBooleanEnv(process.env.FETCHER_DRY_RUN, true),
    writeEnabled: parseBooleanEnv(process.env.FETCHER_WRITE_ENABLED, false),
    maxTotalArticles: parseOptionalPositiveInt(process.env.FETCHER_MAX_TOTAL_ARTICLES),
    sourceKeysFilter: parseFetcherSourceKeys(process.env.FETCHER_SOURCE_KEYS),
  };
}
