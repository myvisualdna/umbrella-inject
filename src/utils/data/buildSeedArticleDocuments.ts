import {
  buildPlaceholderCover,
  parsePlaceholderCoverConfig,
} from "../../gunnerWorker/cover";
import { paragraphsToPortableText } from "../../gunnerWorker/portableText";
import {
  buildCategoryDocumentId,
  buildTagDocumentId,
} from "./canonical-taxonomy";
import {
  CANONICAL_SEED_ARTICLES,
  SEED_AUTHOR_ID,
  type CanonicalSeedArticle,
} from "./canonical-articles";
import { buildPublicationSchedule } from "./validateCanonicalArticles";

function estimateReadTimeMinutes(bodyParagraphs: string[]): number {
  const words = bodyParagraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function buildPublishedDates(article: CanonicalSeedArticle, now: Date): {
  publishedAt: string;
  updatedAt: string;
} {
  const publishedAt = new Date(now.getTime() - article.publishedAtOffsetHours * 60 * 60 * 1000);
  const updatedAt = new Date(publishedAt.getTime() + 15 * 60 * 1000);
  return {
    publishedAt: publishedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function buildTagReferences(categorySlug: string, tagSlugs: string[]) {
  return tagSlugs.map((tagSlug, index) => ({
    _key: `tag-${index}`,
    _type: "reference" as const,
    _ref: buildTagDocumentId(categorySlug, tagSlug),
  }));
}

function buildCommonFields(
  article: CanonicalSeedArticle,
  now: Date
): Record<string, unknown> {
  const { publishedAt, updatedAt } = buildPublishedDates(article, now);
  const { cover } = buildPlaceholderCover(parsePlaceholderCoverConfig());

  return {
    _id: article.id,
    status: "published",
    title: article.title,
    tickerTitle: article.tickerTitle,
    slug: { _type: "slug", current: article.slug },
    excerpt: article.excerpt,
    cover,
    body: paragraphsToPortableText(article.bodyParagraphs),
    seo: {
      _type: "seo",
      title: article.title,
      description: article.excerpt,
    },
    author: {
      _type: "reference",
      _ref: SEED_AUTHOR_ID,
    },
    publishedAt,
    updatedAt,
    readTime: estimateReadTimeMinutes(article.bodyParagraphs),
    mainHeadline: article.homepage?.mainHeadline ?? false,
    frontline: article.homepage?.frontline ?? false,
    rightHeadline: article.homepage?.rightHeadline ?? false,
    justIn: article.homepage?.justIn ?? false,
    breakingNews: article.homepage?.breakingNews ?? false,
    developingStory: article.homepage?.developingStory ?? false,
    featured: article.homepage?.featured ?? false,
  };
}

export function buildSeedArticleDocument(
  article: CanonicalSeedArticle,
  now: Date = new Date()
): Record<string, unknown> {
  const common = buildCommonFields(article, now);

  if (article.articleType === "opinion") {
    return {
      ...common,
      _type: "opinion",
      disclosure: article.disclosure ?? "",
    };
  }

  const categorySlug = article.categorySlug!;
  const base = {
    ...common,
    _type: article.articleType,
    category: {
      _type: "reference",
      _ref: buildCategoryDocumentId(categorySlug),
    },
    tags: buildTagReferences(categorySlug, article.tagSlugs ?? []),
  };

  if (article.articleType === "analysis") {
    return {
      ...base,
      analysisFocus: article.analysisFocus,
    };
  }

  return base;
}

export function buildSeedArticleDocuments(
  articles: CanonicalSeedArticle[] = CANONICAL_SEED_ARTICLES,
  now: Date = new Date()
): Record<string, unknown>[] {
  return articles.map((article) => buildSeedArticleDocument(article, now));
}

export function summarizeSeedArticleDates(
  articles: CanonicalSeedArticle[] = CANONICAL_SEED_ARTICLES,
  now: Date = new Date()
): { earliest: string; latest: string } {
  const schedule = buildPublicationSchedule(
    articles.length,
    now,
    (index) => articles[index]?.publishedAtOffsetHours ?? 0
  );
  const dates = schedule.map((entry) => entry.publishedAt).sort();
  return {
    earliest: dates[0] ?? now.toISOString(),
    latest: dates[dates.length - 1] ?? now.toISOString(),
  };
}
