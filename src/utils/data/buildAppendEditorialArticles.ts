import {
  CANONICAL_CATEGORIES,
  getFirstCanonicalTagForCategory,
} from "./canonical-taxonomy";
import {
  computeOffsetHours,
  type CanonicalSeedArticle,
} from "./canonical-articles";

const DEFAULT_BODY = [
  "Officials described the development as significant for communities watching policy shifts closely.",
  "Agencies said they would release additional details as reviews continue through the week.",
  "Local leaders noted that implementation timelines could vary by region and agency capacity.",
];

/** 20 analysis articles across 8 categories (3+3+2+3+2+3+2+2). */
const ANALYSIS_PER_CATEGORY = [3, 3, 2, 3, 2, 3, 2, 2] as const;

const ANALYSIS_TOPICS = [
  "regulatory timing shifts",
  "cross-agency coordination gaps",
  "budget trade-off decisions",
  "supply chain recalibration",
  "enforcement standard updates",
  "consumer pricing pressures",
  "infrastructure funding delays",
  "workforce transition plans",
  "data transparency gaps",
  "regional compliance timelines",
];

const OPINION_TOPICS = [
  "infrastructure funding priorities",
  "school communication standards",
  "small business trade rules",
  "local journalism sustainability",
  "housing affordability pressures",
  "public health messaging clarity",
  "transit reliability commitments",
  "energy price transparency",
  "community safety planning",
  "digital privacy expectations",
  "workplace flexibility norms",
  "water resource planning",
  "emergency alert systems",
  "childcare access gaps",
  "rural broadband investment",
  "court transparency standards",
  "food supply chain resilience",
  "climate adaptation spending",
  "immigration case backlogs",
  "election information access",
];

export const APPEND_ANALYSIS_COUNT = 20;
export const APPEND_OPINION_COUNT = 20;

function truncateTicker(value: string): string {
  return value.length <= 40 ? value : `${value.slice(0, 37)}...`;
}

export function buildAppendEditorialArticles(
  baseOffsetIndex = 0
): CanonicalSeedArticle[] {
  const articles: CanonicalSeedArticle[] = [];
  let globalIndex = baseOffsetIndex;

  for (let categoryIndex = 0; categoryIndex < CANONICAL_CATEGORIES.length; categoryIndex++) {
    const category = CANONICAL_CATEGORIES[categoryIndex];
    const count = ANALYSIS_PER_CATEGORY[categoryIndex];
    const firstTag = getFirstCanonicalTagForCategory(category.slug);

    for (let index = 1; index <= count; index += 1) {
      const topic = ANALYSIS_TOPICS[globalIndex % ANALYSIS_TOPICS.length];
      const title = `What ${topic} means for ${category.title.toLowerCase()} audiences`;
      articles.push({
        id: `analysis.append.${category.slug}.${String(index).padStart(3, "0")}`,
        articleType: "analysis",
        categorySlug: category.slug,
        tagSlugs: [firstTag.slug],
        title,
        slug: `append-analysis-${category.slug}-${String(index).padStart(3, "0")}`,
        tickerTitle: truncateTicker(`${category.title} readers watch ${topic}`),
        excerpt: `Editors examine ${topic} and how ${category.title.toLowerCase()} coverage could shift in the weeks ahead.`,
        bodyParagraphs: DEFAULT_BODY,
        analysisFocus: `Breaks down ${topic} and likely effects on ${category.title.toLowerCase()} readers.`,
        publishedAtOffsetHours: computeOffsetHours(globalIndex),
      });
      globalIndex += 1;
    }
  }

  for (let index = 1; index <= APPEND_OPINION_COUNT; index += 1) {
    const topic = OPINION_TOPICS[(index - 1) % OPINION_TOPICS.length];
    const title = `Communities deserve clearer answers on ${topic}`;
    articles.push({
      id: `opinion.append.${String(index).padStart(3, "0")}`,
      articleType: "opinion",
      title,
      slug: `append-opinion-${String(index).padStart(3, "0")}`,
      tickerTitle: truncateTicker(`Clearer answers on ${topic}`),
      excerpt:
        "Public debate would improve if leaders explained trade-offs sooner rather than waiting for crisis headlines.",
      bodyParagraphs: DEFAULT_BODY,
      publishedAtOffsetHours: computeOffsetHours(globalIndex),
    });
    globalIndex += 1;
  }

  return articles;
}

export const APPEND_EDITORIAL_ARTICLES: CanonicalSeedArticle[] =
  buildAppendEditorialArticles();
