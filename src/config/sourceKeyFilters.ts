import { scraperSwitches } from "./scraperSwitches";
import type { SourceKey } from "./scrapingControl";

const ALL_SOURCE_KEYS = Object.keys(scraperSwitches) as SourceKey[];
const ALL_SOURCE_KEY_SET = new Set<SourceKey>(ALL_SOURCE_KEYS);

export function parseSourceKeysEnv(
  raw: string | undefined,
  envName: string
): Set<SourceKey> | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is SourceKey => value.length > 0);

  const invalid = parsed.filter((value) => !ALL_SOURCE_KEY_SET.has(value));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid ${envName}. Unknown source keys: ${invalid.join(", ")}`
    );
  }

  return new Set(parsed);
}
