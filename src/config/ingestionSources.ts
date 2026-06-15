export function parseEnabledSourceKeys(raw?: string): Set<string> | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const keys = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (keys.length === 0) {
    return null;
  }

  return new Set(keys);
}

export function isSourceEnabled(
  sourceKey: string,
  enabledSourceKeys: Set<string> | null
): boolean {
  if (!enabledSourceKeys) return true;
  return enabledSourceKeys.has(sourceKey);
}
