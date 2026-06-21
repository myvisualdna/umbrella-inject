import type {
  AiArticleProvider,
  AiProviderResult,
  ProcessedArticlePayload,
  ProcessedArticleContentType,
  WorkerStoryCandidate,
} from "../types";
import { loadAiTagCatalog } from "../tagCatalog";

const TICKER_TITLE_MAX = 40;
const EXCERPT_MAX = 280;

function clampLength(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

function splitIntoParagraphs(body: string): string[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length > 0) return paragraphs;

  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? [collapsed] : ["No body content available."];
}

function buildExcerpt(candidate: WorkerStoryCandidate, paragraphs: string[]): string {
  const base = candidate.excerpt?.trim() || paragraphs[0] || candidate.title;
  return clampLength(base, EXCERPT_MAX);
}

/**
 * Deterministically derives tag slugs from the current catalog.
 * Returns catalog-only slugs; if no match is possible, returns [].
 */
function buildTagSlugs(candidate: WorkerStoryCandidate): string[] {
  const catalog = loadAiTagCatalog(candidate.category);
  if (catalog.length === 0) {
    return [];
  }

  const allowed = new Set(catalog.map((item) => item.slug));
  const selected = new Set<string>();

  const sourceWords = `${candidate.source_key} ${candidate.title}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  for (const word of sourceWords) {
    if (allowed.has(word)) {
      selected.add(word);
    }
    if (selected.size >= 6) break;
  }

  return Array.from(selected).slice(0, 6);
}

function classify(candidate: WorkerStoryCandidate): {
  importanceScore: number;
  breakingNewsScore: number;
  contentType: ProcessedArticleContentType;
  confidence: number;
} {
  return {
    importanceScore: 5,
    breakingNewsScore: 3,
    contentType: "news",
    confidence: 0.5,
  };
}

export function buildMockProcessedArticle(
  candidate: WorkerStoryCandidate
): ProcessedArticlePayload {
  const paragraphs = splitIntoParagraphs(candidate.body);
  const excerpt = buildExcerpt(candidate, paragraphs);
  const tagSlugs = buildTagSlugs(candidate);

  return {
    title: candidate.title,
    tickerTitle: clampLength(candidate.title, TICKER_TITLE_MAX),
    excerpt,
    body: paragraphs,
    category: candidate.category,
    tagSlugs,
    seo: {
      title: clampLength(candidate.title, 60),
      description: excerpt,
    },
    classification: classify(candidate),
    sourceAttribution: {
      sourceName: candidate.source_name,
      sourceUrl: candidate.source_url,
      publishedAt: candidate.published_at,
    },
    editorialNotes: {
      summary: `Mock-processed draft generated from ${candidate.source_name}.`,
      keyFacts: [paragraphs[0]].filter((fact): fact is string => Boolean(fact)),
      riskFlags: ["mock-output", "requires-human-review"],
      humanReviewRequired: true,
    },
  };
}

export class MockAiProvider implements AiArticleProvider {
  readonly name = "mock" as const;

  async generateArticleDraft(
    candidate: WorkerStoryCandidate
  ): Promise<AiProviderResult> {
    const startedAt = Date.now();
    const payload = buildMockProcessedArticle(candidate);

    return {
      payload,
      meta: {
        provider: "mock",
        model: null,
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        usage: null,
        raw: {
          provider: "mock",
          deterministic: true,
          note: "Generated locally without any external API call.",
        },
      },
    };
  }
}
