/**
 * Lightweight Step 3 verification (no Supabase, no network).
 * Validates the mock provider output and the payload validator rules.
 */

import { buildMockProcessedArticle, MockAiProvider } from "../ai/providers/mockAiProvider";
import {
  buildSystemPrompt,
  buildSystemPromptForCandidate,
  resolveEditorialTonePreset,
} from "../ai/prompt";
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
    ingestion_batch_id: null,
    ingestion_run_id: null,
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

function testResolveEditorialTonePreset(): void {
  const cases: Array<{ category: string; expected: ReturnType<typeof resolveEditorialTonePreset> }> =
    [
      { category: "US", expected: "wire_direct" },
      { category: "us", expected: "wire_direct" },
      { category: "World", expected: "wire_direct" },
      { category: "world", expected: "wire_direct" },
      { category: "Politics", expected: "political_insider" },
      { category: "politics", expected: "political_insider" },
      { category: "Business", expected: "business_brief" },
      { category: "business", expected: "business_brief" },
      { category: "Science", expected: "explainer_context" },
      { category: "science", expected: "explainer_context" },
      { category: "Tech", expected: "explainer_context" },
      { category: "tech", expected: "explainer_context" },
      { category: "Entertainment", expected: "angle_default" },
      { category: "entertainment", expected: "angle_default" },
      { category: "Lifestyle", expected: "angle_default" },
      { category: "lifestyle", expected: "angle_default" },
      { category: "unknown", expected: "angle_default" },
    ];

  for (const { category, expected } of cases) {
    assert(
      resolveEditorialTonePreset(buildCandidate({ category })) === expected,
      `Expected category "${category}" to map to ${expected}`
    );
  }

  assert(
    resolveEditorialTonePreset(
      buildCandidate({
        category: "entertainment",
        title: "Markets rally as election results shift policy outlook",
        excerpt: "Congress and business leaders react to breaking campaign news.",
      })
    ) === "angle_default",
    "Expected title/excerpt keywords not to override entertainment category preset"
  );
}

function testOpenAiProviderPathUsesResolvedPresetInSystemPrompt(): void {
  const businessCandidate = buildCandidate({ category: "business" });
  const businessPrompt = buildSystemPromptForCandidate(businessCandidate, []);
  assert(
    resolveEditorialTonePreset(businessCandidate) === "business_brief",
    "Expected business category to resolve to business_brief before prompt build"
  );
  assert(
    businessPrompt.includes("Editorial tone: business_brief."),
    "Expected OpenAI provider path to include resolved business_brief preset in system prompt"
  );
  assert(
    businessPrompt.includes("Focus on companies, markets, money, strategy, jobs, and consumer impact."),
    "Expected business_brief preset guidance in system prompt"
  );

  const politicsCandidate = buildCandidate({ category: "politics" });
  const politicsPrompt = buildSystemPromptForCandidate(politicsCandidate, []);
  assert(
    politicsPrompt.includes("Editorial tone: political_insider."),
    "Expected OpenAI provider path to include resolved political_insider preset in system prompt"
  );

  const unknownCandidate = buildCandidate({ category: "unknown" });
  const unknownPrompt = buildSystemPromptForCandidate(unknownCandidate, []);
  assert(
    unknownPrompt.includes("Editorial tone: angle_default."),
    "Expected unknown category to fall back to angle_default in system prompt"
  );
}

function testBuildSystemPromptLowLevelHelper(): void {
  // Low-level helper tests: direct preset + tag list without candidate resolution.
  const politicalPrompt = buildSystemPrompt(["white-house"], "political_insider");
  assert(
    politicalPrompt.includes("Editorial tone: political_insider."),
    "Expected preset name in system prompt header"
  );
  assert(
    politicalPrompt.includes("Focus on power, institutions, policy, campaigns, and consequences."),
    "Expected political_insider preset text in system prompt"
  );
  assert(
    politicalPrompt.includes("Preserve facts, names, dates, quotes, and source meaning. Do not invent information."),
    "Expected fact preservation rule in system prompt"
  );
  assert(
    politicalPrompt.includes("Use fresh wording and structure; do not closely paraphrase."),
    "Expected fresh wording rule in system prompt"
  );
  assert(
    politicalPrompt.includes("editorialNotes.humanReviewRequired must be true"),
    "Expected humanReviewRequired rule in system prompt"
  );
  assert(
    politicalPrompt.includes("tickerTitle: max 40 characters"),
    "Expected tickerTitle rule in system prompt"
  );
  assert(
    politicalPrompt.includes("sourceAttribution.sourceUrl must exactly match the input url."),
    "Expected source URL rule in system prompt"
  );
  assert(
    politicalPrompt.includes("Return only the structured JSON object."),
    "Expected structured JSON instruction in system prompt"
  );

  const emptyTagsPrompt = buildSystemPrompt([], "angle_default");
  assert(
    emptyTagsPrompt.includes("Use tagSlugs: []"),
    "Expected empty tag instruction when allowed tags are empty"
  );
}

async function main(): Promise<void> {
  testResolveEditorialTonePreset();
  testOpenAiProviderPathUsesResolvedPresetInSystemPrompt();
  testBuildSystemPromptLowLevelHelper();
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
