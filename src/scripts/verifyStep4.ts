/**
 * Lightweight Step 4 verification (no Supabase, no Sanity, no network).
 * Validates the Gunner Worker pure functions: portable text conversion,
 * mapper safety (draft-only, no publish/homepage), draft validator rejections,
 * and category resolution via the local cache.
 */

import type { ProcessedArticlePayload } from "../ai/types";
import {
  buildDraftId,
  mapProcessedPayloadToSanityDraft,
} from "../gunnerWorker/mapProcessedPayloadToSanityDraft";
import { parsePlaceholderCoverConfig } from "../gunnerWorker/cover";
import { paragraphsToPortableText } from "../gunnerWorker/portableText";
import { validateSanityDraftPayload } from "../gunnerWorker/validateSanityDraftPayload";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const CANDIDATE_ID = "00000000-0000-0000-0000-000000000042";
const PLACEHOLDER_COVER = parsePlaceholderCoverConfig({
  ...process.env,
  GUNNER_PLACEHOLDER_COVER_URL: "https://example.com/editorial-placeholder.jpg",
});

function buildPayload(
  overrides?: Partial<ProcessedArticlePayload>
): ProcessedArticlePayload {
  return {
    title: "A sufficiently long and valid example headline",
    tickerTitle: "Example ticker",
    excerpt: "Example excerpt for the story.",
    body: ["First paragraph of the body.", "Second paragraph of the body."],
    category: "business",
    tagSlugs: ["markets", "economy"],
    seo: {
      title: "Example SEO title",
      description: "Example SEO description.",
    },
    classification: {
      importanceScore: 5,
      breakingNewsScore: 2,
      contentType: "news",
      confidence: 0.8,
    },
    sourceAttribution: {
      sourceName: "Example News",
      sourceUrl: "https://example.com/story",
      publishedAt: "2026-06-13T00:00:00.000Z",
    },
    editorialNotes: {
      summary: "Short summary.",
      keyFacts: ["fact one", "fact two"],
      riskFlags: [],
      humanReviewRequired: true,
    },
    ...overrides,
  };
}

function testPortableText(): void {
  const blocks = paragraphsToPortableText(
    ["First.", "   ", "", "Second."],
    "body"
  );
  assert(blocks.length === 2, `Expected 2 blocks (empties dropped), got ${blocks.length}`);
  assert(blocks[0]._key === "body-b0", `Expected stable key body-b0, got ${blocks[0]._key}`);
  assert(blocks[0]._type === "block", "Expected _type block");
  assert(blocks[0].style === "normal", "Expected style normal");
  assert(Array.isArray(blocks[0].markDefs), "Expected markDefs array");
  assert(
    blocks[0].children[0]._type === "span" &&
      blocks[0].children[0]._key === "body-s0" &&
      blocks[0].children[0].text === "First." &&
      Array.isArray(blocks[0].children[0].marks),
    "Expected well-formed span"
  );

  // Deterministic: same input -> same output.
  const again = paragraphsToPortableText(["First.", "   ", "", "Second."], "body");
  assert(
    JSON.stringify(again) === JSON.stringify(blocks),
    "Expected deterministic portable text output"
  );
}

function testMapperSafety(): void {
  const payload = buildPayload();
  const { draft } = mapProcessedPayloadToSanityDraft(
    CANDIDATE_ID,
    payload,
    { imageUrl: "not-a-real-cover" },
    { placeholderCover: PLACEHOLDER_COVER }
  );

  assert(draft.status === "draft", `Expected status draft, got ${draft.status}`);
  assert(draft._type === "post", `Expected _type post, got ${draft._type}`);
  assert(
    draft._id === buildDraftId(CANDIDATE_ID) && draft._id.startsWith("drafts.ingest-"),
    `Expected deterministic drafts.ingest- id, got ${draft._id}`
  );
  assert(Array.isArray(draft.body) && draft.body.length === 2, "Expected body blocks present");
  assert(Boolean(draft.cover), "Expected placeholder cover to be present");
  assert(draft.cover.source === "external", "Expected placeholder cover source external");

  const record = draft as unknown as Record<string, unknown>;
  assert(record.publishedAt === undefined, "Expected no publishedAt");
  assert(record.bodyTextOne === undefined, "Expected no bodyTextOne");
  assert(record.date === undefined, "Expected no date");
  assert(
    draft.mainHeadline === false &&
      draft.frontline === false &&
      draft.rightHeadline === false &&
      draft.justIn === false &&
      draft.breakingNews === false &&
      draft.developingStory === false &&
      draft.featured === false,
    "Expected all homepage/editorial flags to be false"
  );

  const validation = validateSanityDraftPayload(draft);
  assert(
    validation.valid,
    `Expected mapped draft to be valid, got: ${validation.issues.join("; ")}`
  );
}

function testCategoryResolution(): void {
  const payload = buildPayload({ category: "business" });
  const { draft } = mapProcessedPayloadToSanityDraft(
    CANDIDATE_ID,
    payload,
    {},
    { placeholderCover: PLACEHOLDER_COVER }
  );
  assert(
    Boolean(draft.category && draft.category._ref),
    "Expected business category to resolve to a reference via cache"
  );
}

function testTickerTitleMaxRejected(): void {
  const payload = buildPayload({ tickerTitle: "z".repeat(41) });
  const { draft } = mapProcessedPayloadToSanityDraft(
    CANDIDATE_ID,
    payload,
    {},
    { placeholderCover: PLACEHOLDER_COVER }
  );
  const validation = validateSanityDraftPayload(draft);
  assert(!validation.valid, "Expected rejection for tickerTitle > 40");
  assert(
    validation.issues.some((i) => i.includes("tickerTitle")),
    "Expected tickerTitle issue"
  );
}

function testValidatorRejectsUnsafeDocs(): void {
  const payload = buildPayload();
  const { draft } = mapProcessedPayloadToSanityDraft(
    CANDIDATE_ID,
    payload,
    {},
    { placeholderCover: PLACEHOLDER_COVER }
  );

  // status published
  const published = { ...draft, status: "published" } as unknown;
  assert(!validateSanityDraftPayload(published).valid, "Expected rejection for status published");

  // publishedAt present
  const withPublishedAt = { ...draft, publishedAt: "2026-06-13T00:00:00.000Z" } as unknown;
  assert(
    !validateSanityDraftPayload(withPublishedAt).valid,
    "Expected rejection when publishedAt present"
  );

  // bodyTextOne present
  const withBodyTextOne = { ...draft, bodyTextOne: "legacy body" } as unknown;
  assert(
    !validateSanityDraftPayload(withBodyTextOne).valid,
    "Expected rejection when bodyTextOne present"
  );

  // homepage flag enabled
  const withFlag = { ...draft, mainHeadline: true } as unknown;
  assert(
    !validateSanityDraftPayload(withFlag).valid,
    "Expected rejection when a homepage flag is enabled"
  );

  // non-draft id
  const badId = { ...draft, _id: "ingest-123" } as unknown;
  assert(!validateSanityDraftPayload(badId).valid, "Expected rejection for non-draft _id");

  // missing category
  const noCategory = { ...draft, category: undefined } as unknown;
  assert(
    !validateSanityDraftPayload(noCategory).valid,
    "Expected rejection when category reference missing"
  );
}

function main(): void {
  testPortableText();
  testMapperSafety();
  testCategoryResolution();
  testTickerTitleMaxRejected();
  testValidatorRejectsUnsafeDocs();
  console.log("verifyStep4: PASS");
}

try {
  main();
} catch (error) {
  console.error("verifyStep4: FAIL");
  console.error(error);
  process.exit(1);
}
