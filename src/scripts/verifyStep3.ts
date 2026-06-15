/**
 * Lightweight Step 3 verification (no Supabase, no network).
 * Validates the mock provider output and the payload validator rules.
 */

import { buildMockProcessedArticle, MockAiProvider } from "../ai/providers/mockAiProvider";
import { validateProcessedArticle } from "../ai/validateProcessedArticle";
import type { ProcessedArticlePayload, WorkerStoryCandidate } from "../ai/types";

const TEST_ALLOWED_TAG_SLUGS = ["economy", "markets", "white-house"];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildCandidate(
  overrides?: Partial<WorkerStoryCandidate>
): WorkerStoryCandidate {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    source_key: "cbsUS",
    source_name: "CBS News US",
    source_url: "https://www.cbsnews.com/news/example-story",
    title: "A sufficiently long and valid example headline",
    excerpt: "Example excerpt for the story.",
    body: Array.from({ length: 6 }, (_, p) =>
      Array.from({ length: 40 }, (_, i) => `word${p}_${i}`).join(" ")
    ).join("\n\n"),
    category: "us",
    published_at: "2026-06-13T00:00:00.000Z",
    scraped_at: "2026-06-13T01:00:00.000Z",
    status: "pending",
    attempt_count: 0,
    ...overrides,
  };
}

async function testMockProviderValid(): Promise<void> {
  const candidate = buildCandidate();
  const provider = new MockAiProvider();
  const result = await provider.generateArticleDraft(candidate);

  const validation = validateProcessedArticle(result.payload, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(
    validation.valid,
    `Expected mock payload valid, got: ${validation.reasons.join(", ")}`
  );
  assert(result.meta.provider === "mock", "Expected mock provider meta");
  assert(result.meta.model === null, "Expected mock model to be null");
  assert(
    result.payload.editorialNotes.humanReviewRequired === true,
    "Expected humanReviewRequired true"
  );
  assert(
    result.payload.sourceAttribution.sourceUrl === candidate.source_url,
    "Expected sourceUrl to match candidate"
  );
}

function testTickerTitleMax(): void {
  const longTitle = "x".repeat(120);
  const candidate = buildCandidate({ title: longTitle });
  const payload = buildMockProcessedArticle(candidate);
  assert(
    payload.tickerTitle.length <= 40,
    `Expected tickerTitle <= 40, got ${payload.tickerTitle.length}`
  );

  const validation = validateProcessedArticle(payload, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(validation.valid, `Expected valid payload, got: ${validation.reasons.join(", ")}`);
}

function testValidatorRejectsInvalid(): void {
  const candidate = buildCandidate();
  const base = buildMockProcessedArticle(candidate);

  // tickerTitle too long
  const longTicker: ProcessedArticlePayload = {
    ...base,
    tickerTitle: "y".repeat(41),
  };
  const longTickerResult = validateProcessedArticle(longTicker, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(!longTickerResult.valid, "Expected rejection for tickerTitle > 40");

  // sourceUrl mismatch
  const mismatchResult = validateProcessedArticle(base, {
    expectedSourceUrl: "https://different.example.com/other",
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(!mismatchResult.valid, "Expected rejection for sourceUrl mismatch");
  assert(
    mismatchResult.reasons.some((r) => r.includes("sourceUrl")),
    "Expected sourceUrl mismatch reason"
  );

  // humanReviewRequired false
  const noReview: ProcessedArticlePayload = {
    ...base,
    editorialNotes: { ...base.editorialNotes, humanReviewRequired: false },
  };
  const noReviewResult = validateProcessedArticle(noReview, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(!noReviewResult.valid, "Expected rejection when humanReviewRequired is false");

  // unknown tag slug
  const unknownTag: ProcessedArticlePayload = { ...base, tagSlugs: ["does-not-exist"] };
  const unknownTagResult = validateProcessedArticle(unknownTag, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(!unknownTagResult.valid, "Expected rejection for unknown tag slug");

  // confidence out of range
  const badConfidence: ProcessedArticlePayload = {
    ...base,
    classification: { ...base.classification, confidence: 5 },
  };
  const badConfidenceResult = validateProcessedArticle(badConfidence, {
    expectedSourceUrl: candidate.source_url,
    allowedTagSlugs: TEST_ALLOWED_TAG_SLUGS,
  });
  assert(!badConfidenceResult.valid, "Expected rejection for confidence > 1");
}

async function main(): Promise<void> {
  await testMockProviderValid();
  testTickerTitleMax();
  testValidatorRejectsInvalid();
  console.log("verifyStep3: PASS");
}

main().catch((error) => {
  console.error("verifyStep3: FAIL");
  console.error(error);
  process.exit(1);
});
