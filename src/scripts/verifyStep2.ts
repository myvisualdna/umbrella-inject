import { parseEnabledSourceKeys, isSourceEnabled } from "../config/ingestionSources";
import {
  toStoryCandidateRow,
  validateForInsert,
} from "../db/storyCandidates";
import type { NormalizedStoryCandidate } from "../normalization/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testAllowlistParsing(): void {
  const empty = parseEnabledSourceKeys();
  assert(empty === null, "Expected null allowlist for unset input");

  const parsed = parseEnabledSourceKeys("cbsUS, techCrunch ,,abcNewsUS");
  assert(parsed !== null, "Expected allowlist set");
  assert(parsed?.has("cbsUS") === true, "Expected cbsUS in allowlist");
  assert(parsed?.has("techCrunch") === true, "Expected techCrunch in allowlist");
  assert(parsed?.has("abcNewsUS") === true, "Expected abcNewsUS in allowlist");

  assert(isSourceEnabled("cbsUS", parsed) === true, "Expected cbsUS enabled");
  assert(isSourceEnabled("apNewsUS", parsed) === false, "Expected apNewsUS disabled");
  assert(isSourceEnabled("anything", null) === true, "Expected all enabled when allowlist unset");
}

function buildCandidate(overrides?: Partial<NormalizedStoryCandidate>): NormalizedStoryCandidate {
  return {
    sourceKey: "cbsUS",
    sourceName: "CBS News US",
    sourceUrl: "https://www.cbsnews.com/news/example-story",
    title: "Valid test title",
    excerpt: "Example excerpt",
    body: Array.from({ length: 160 }, (_, i) => `word${i + 1}`).join(" "),
    category: "us",
    publishedAt: "2026-06-13T00:00:00.000Z",
    scrapedAt: "2026-06-13T01:00:00.000Z",
    rawPayload: { test: true },
    success: true,
    error: null,
    ...overrides,
  };
}

function testValidationAndMapping(): void {
  const valid = buildCandidate();
  const validation = validateForInsert(valid);
  assert(validation.valid, `Expected candidate valid, got: ${validation.reasons.join(", ")}`);

  const row = toStoryCandidateRow(valid);
  assert(row.status === "pending", "Expected row status pending");
  assert(row.source_key === valid.sourceKey, "Expected source_key mapping");
  assert(row.source_url === valid.sourceUrl, "Expected source_url mapping");
  assert(row.raw_payload === valid.rawPayload, "Expected raw payload mapping");

  const invalid = buildCandidate({ sourceName: "", body: "too short" });
  const invalidValidation = validateForInsert(invalid);
  assert(!invalidValidation.valid, "Expected invalid candidate");
  assert(
    invalidValidation.reasons.includes("missing sourceName"),
    "Expected missing sourceName reason"
  );
  assert(
    invalidValidation.reasons.includes("body shorter than 150 words"),
    "Expected body length rejection reason"
  );
}

function main(): void {
  testAllowlistParsing();
  testValidationAndMapping();
  console.log("verifyStep2: PASS");
}

main();
