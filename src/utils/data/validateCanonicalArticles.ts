import {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_TAGS,
  getCanonicalCategoryBySlug,
} from "./canonical-taxonomy";
import {
  CANONICAL_SEED_ARTICLES,
  type CanonicalSeedArticle,
  type SeedArticleType,
} from "./canonical-articles";

const MAX_OFFSET_HOURS = 14 * 24;
const BANNED_TITLE_PATTERN = /\b(opinion|analysis)\b/i;
const MAX_TICKER_LENGTH = 40;

export interface PublicationScheduleEntry {
  publishedAt: string;
  updatedAt: string;
}

export function buildPublicationSchedule(
  count: number,
  now: Date,
  offsetHoursForIndex: (index: number) => number = (index) => {
    if (index === 0) return 2;
    const step = Math.floor(MAX_OFFSET_HOURS / Math.max(count, 1));
    return Math.min(MAX_OFFSET_HOURS, 2 + index * step);
  }
): PublicationScheduleEntry[] {
  const schedule: PublicationScheduleEntry[] = [];
  const nowMs = now.getTime();

  for (let index = 0; index < count; index++) {
    const offsetHours = offsetHoursForIndex(index);
    const publishedAt = new Date(nowMs - offsetHours * 60 * 60 * 1000);
    const updatedAt = new Date(publishedAt.getTime() + (index + 1) * 15 * 60 * 1000);
    schedule.push({
      publishedAt: publishedAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  }

  return schedule;
}

function assertTagBelongsToCategory(categorySlug: string, tagSlug: string): void {
  const tags = CANONICAL_CATEGORY_TAGS[categorySlug] ?? [];
  if (!tags.some((tag) => tag.slug === tagSlug)) {
    throw new Error(`Tag "${tagSlug}" is not in category "${categorySlug}"`);
  }
}

function validateArticleShape(article: CanonicalSeedArticle): void {
  if (!article.id.trim()) {
    throw new Error("Seed article id must be non-empty");
  }
  if (!article.title.trim()) {
    throw new Error(`Seed article ${article.id} must have a title`);
  }
  if (!article.slug.trim()) {
    throw new Error(`Seed article ${article.id} must have a slug`);
  }
  if (!article.tickerTitle.trim()) {
    throw new Error(`Seed article ${article.id} must have a tickerTitle`);
  }
  if (article.tickerTitle.length > MAX_TICKER_LENGTH) {
    throw new Error(
      `Seed article ${article.id} tickerTitle exceeds ${MAX_TICKER_LENGTH} chars`
    );
  }
  if (!article.excerpt.trim()) {
    throw new Error(`Seed article ${article.id} must have an excerpt`);
  }
  if (!article.bodyParagraphs.length || article.bodyParagraphs.some((p) => !p.trim())) {
    throw new Error(`Seed article ${article.id} must have non-empty bodyParagraphs`);
  }
  if (
    article.publishedAtOffsetHours < 0 ||
    article.publishedAtOffsetHours > MAX_OFFSET_HOURS
  ) {
    throw new Error(
      `Seed article ${article.id} publishedAtOffsetHours must be within [0, ${MAX_OFFSET_HOURS}]`
    );
  }

  if (article.articleType === "opinion") {
    if (article.categorySlug || (article.tagSlugs && article.tagSlugs.length > 0)) {
      throw new Error(`Opinion article ${article.id} must not include category or tags`);
    }
    if (BANNED_TITLE_PATTERN.test(article.title)) {
      throw new Error(`Opinion article ${article.id} title contains banned word`);
    }
    return;
  }

  if (!article.categorySlug) {
    throw new Error(`Article ${article.id} requires categorySlug`);
  }
  if (!getCanonicalCategoryBySlug(article.categorySlug)) {
    throw new Error(`Article ${article.id} references unknown category: ${article.categorySlug}`);
  }
  if (!article.tagSlugs?.length) {
    throw new Error(`Article ${article.id} requires at least one tag`);
  }

  for (const tagSlug of article.tagSlugs) {
    assertTagBelongsToCategory(article.categorySlug, tagSlug);
  }

  if (article.articleType === "analysis") {
    if (!article.analysisFocus?.trim()) {
      throw new Error(`Analysis article ${article.id} requires analysisFocus`);
    }
    if (BANNED_TITLE_PATTERN.test(article.title)) {
      throw new Error(`Analysis article ${article.id} title contains banned word`);
    }
  }
}

export interface CanonicalArticleValidationSummary {
  total: number;
  byType: Record<SeedArticleType, number>;
  byCategory: Record<string, number>;
  tagUsage: Record<string, number>;
  dateRange: { earliest: string; latest: string };
}

export function validateSeedArticleList(
  articles: CanonicalSeedArticle[],
  now: Date = new Date()
): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const titles = new Set<string>();

  for (const article of articles) {
    if (ids.has(article.id)) {
      throw new Error(`Duplicate seed article id: ${article.id}`);
    }
    ids.add(article.id);

    if (slugs.has(article.slug)) {
      throw new Error(`Duplicate seed article slug: ${article.slug}`);
    }
    slugs.add(article.slug);

    if (titles.has(article.title)) {
      throw new Error(`Duplicate seed article title: ${article.title}`);
    }
    titles.add(article.title);

    validateArticleShape(article);
  }

  const schedule = buildPublicationSchedule(
    articles.length,
    now,
    (index) => articles[index]?.publishedAtOffsetHours ?? 0
  );

  for (const entry of schedule) {
    const publishedAt = new Date(entry.publishedAt);
    if (publishedAt.getTime() > now.getTime()) {
      throw new Error("Publication schedule must not include future dates");
    }
    const ageMs = now.getTime() - publishedAt.getTime();
    if (ageMs > MAX_OFFSET_HOURS * 60 * 60 * 1000 + 60_000) {
      throw new Error("Publication schedule includes dates older than 14 days");
    }
  }
}

export function validateCanonicalArticles(
  articles: CanonicalSeedArticle[] = CANONICAL_SEED_ARTICLES,
  now: Date = new Date()
): CanonicalArticleValidationSummary {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const titles = new Set<string>();

  for (const article of articles) {
    if (ids.has(article.id)) {
      throw new Error(`Duplicate seed article id: ${article.id}`);
    }
    ids.add(article.id);

    if (slugs.has(article.slug)) {
      throw new Error(`Duplicate seed article slug: ${article.slug}`);
    }
    slugs.add(article.slug);

    if (titles.has(article.title)) {
      throw new Error(`Duplicate seed article title: ${article.title}`);
    }
    titles.add(article.title);

    validateArticleShape(article);
  }

  const categoryScoped = articles.filter((article) => article.articleType !== "opinion");
  if (categoryScoped.length < 32) {
    throw new Error(`Expected at least 32 category-scoped articles, found ${categoryScoped.length}`);
  }

  for (const category of CANONICAL_CATEGORIES) {
    const count = categoryScoped.filter((article) => article.categorySlug === category.slug).length;
    if (count < 4) {
      throw new Error(`Category ${category.slug} expected 4 articles, found ${count}`);
    }
  }

  const schedule = buildPublicationSchedule(
    articles.length,
    now,
    (index) => articles[index]?.publishedAtOffsetHours ?? 0
  );

  for (const entry of schedule) {
    const publishedAt = new Date(entry.publishedAt);
    if (publishedAt.getTime() > now.getTime()) {
      throw new Error("Publication schedule must not include future dates");
    }
    const ageMs = now.getTime() - publishedAt.getTime();
    if (ageMs > MAX_OFFSET_HOURS * 60 * 60 * 1000 + 60_000) {
      throw new Error("Publication schedule includes dates older than 14 days");
    }
  }

  const byType: Record<SeedArticleType, number> = {
    post: 0,
    analysis: 0,
    opinion: 0,
  };
  const byCategory: Record<string, number> = {};
  const tagUsage: Record<string, number> = {};

  for (const article of articles) {
    byType[article.articleType] += 1;
    if (article.categorySlug) {
      byCategory[article.categorySlug] = (byCategory[article.categorySlug] ?? 0) + 1;
    }
    for (const tagSlug of article.tagSlugs ?? []) {
      tagUsage[tagSlug] = (tagUsage[tagSlug] ?? 0) + 1;
    }
  }

  const publishedDates = schedule.map((entry) => entry.publishedAt).sort();
  return {
    total: articles.length,
    byType,
    byCategory,
    tagUsage,
    dateRange: {
      earliest: publishedDates[0] ?? now.toISOString(),
      latest: publishedDates[publishedDates.length - 1] ?? now.toISOString(),
    },
  };
}

export function assertHomepageTagCoverage(
  articles: CanonicalSeedArticle[] = CANONICAL_SEED_ARTICLES
): void {
  const required = ["congress", "white-house", "artificial-intelligence", "china"];
  const used = new Set<string>();
  for (const article of articles) {
    for (const tagSlug of article.tagSlugs ?? []) {
      used.add(tagSlug);
    }
  }
  for (const tagSlug of required) {
    if (!used.has(tagSlug)) {
      throw new Error(`Homepage tag "${tagSlug}" is not used by any seed article`);
    }
  }
}
