export interface CanonicalCategory {
  title: string;
  slug: string;
}

export interface CanonicalTag {
  title: string;
  slug: string;
  aliases: string[];
}

export interface FlatCanonicalTag extends CanonicalTag {
  categorySlug: string;
}

export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  { title: "US", slug: "us" },
  { title: "World", slug: "world" },
  { title: "Politics", slug: "politics" },
  { title: "Business", slug: "business" },
  { title: "Science", slug: "science" },
  { title: "Entertainment", slug: "entertainment" },
  { title: "Tech", slug: "tech" },
  { title: "Lifestyle", slug: "lifestyle" },
];

export const CANONICAL_CATEGORY_TAGS: Record<string, CanonicalTag[]> = {
  us: [
    { title: "Trump", slug: "trump", aliases: ["donald trump", "president trump"] },
    { title: "Iran War", slug: "iran-war", aliases: ["iran conflict", "us iran", "iran"] },
    { title: "Crime", slug: "crime", aliases: ["criminal justice", "public safety"] },
    { title: "Abortion", slug: "abortion", aliases: ["reproductive rights"] },
    { title: "Education", slug: "education", aliases: ["schools", "students"] },
    { title: "Weather", slug: "weather", aliases: ["storms", "forecast", "extreme weather"] },
  ],
  world: [
    { title: "China", slug: "china", aliases: ["beijing", "chinese government"] },
    { title: "Europe", slug: "europe", aliases: ["european union", "eu"] },
    { title: "Middle East", slug: "middle-east", aliases: ["mideast", "gulf region"] },
    { title: "Latin America", slug: "latin-america", aliases: ["latam"] },
    { title: "Africa", slug: "africa", aliases: [] },
  ],
  politics: [
    { title: "Immigration", slug: "immigration", aliases: ["border", "migrants", "asylum"] },
    { title: "White House", slug: "white-house", aliases: ["administration", "presidency"] },
    { title: "Congress", slug: "congress", aliases: ["house", "senate", "capitol hill"] },
    { title: "Elections", slug: "elections", aliases: ["campaigns", "voting", "polls"] },
    { title: "Supreme Court", slug: "supreme-court", aliases: ["scotus", "high court"] },
  ],
  business: [
    { title: "Markets", slug: "markets", aliases: ["stocks", "wall street"] },
    { title: "Economy", slug: "economy", aliases: ["economic growth", "gdp"] },
    { title: "Finance", slug: "finance", aliases: ["banking", "financial sector"] },
    { title: "Tariffs", slug: "tariffs", aliases: ["trade duties", "trade policy"] },
    { title: "Inflation", slug: "inflation", aliases: ["prices", "cost of living"] },
    { title: "Real Estate", slug: "real-estate", aliases: ["housing", "mortgage rates"] },
  ],
  science: [
    { title: "Space", slug: "space", aliases: ["nasa", "astronomy"] },
    { title: "Life Sciences", slug: "life-sciences", aliases: ["biology", "genetics", "life"] },
    { title: "Climate", slug: "climate", aliases: ["climate change", "global warming"] },
  ],
  entertainment: [
    { title: "Movies", slug: "movies", aliases: ["film", "box office"] },
    { title: "Television", slug: "television", aliases: ["tv", "streaming"] },
    { title: "Fashion", slug: "fashion", aliases: ["style"] },
    { title: "Music", slug: "music", aliases: ["albums", "concerts"] },
    { title: "Celebrity", slug: "celebrity", aliases: ["celebrities", "stars"] },
  ],
  tech: [
    {
      title: "Artificial Intelligence",
      slug: "artificial-intelligence",
      aliases: ["ai", "generative ai", "machine learning"],
    },
    {
      title: "Social Media",
      slug: "social-media",
      aliases: ["platforms", "facebook", "instagram", "tiktok", "x"],
    },
  ],
  lifestyle: [
    { title: "Food", slug: "food", aliases: ["restaurants", "cooking"] },
    { title: "Travel", slug: "travel", aliases: ["tourism", "destinations"] },
    { title: "Culture", slug: "culture", aliases: ["society"] },
    { title: "Health", slug: "health", aliases: ["wellness", "fitness"] },
    { title: "Beauty", slug: "beauty", aliases: ["skincare", "cosmetics"] },
  ],
};

export function buildCategoryDocumentId(slug: string): string {
  return `category.${slug.trim().toLowerCase()}`;
}

export function buildTagDocumentId(categorySlug: string, tagSlug: string): string {
  return `tag.${categorySlug.trim().toLowerCase()}.${tagSlug.trim().toLowerCase()}`;
}

/** First canonical tag per category (used for append-seed article tagging). */
export function getFirstCanonicalTagForCategory(
  categorySlug: string
): CanonicalTag {
  const tags = CANONICAL_CATEGORY_TAGS[categorySlug];
  if (!tags?.[0]) {
    throw new Error(`No canonical tags for category: ${categorySlug}`);
  }
  return tags[0];
}

export function buildFirstCanonicalTagIdByCategory(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const category of CANONICAL_CATEGORIES) {
    const firstTag = getFirstCanonicalTagForCategory(category.slug);
    map[category.slug] = buildTagDocumentId(category.slug, firstTag.slug);
  }
  return map;
}

export const LAYOUT_SEED_BATCH_TAG_SLUG = "layout-seed-batch";

export function buildLayoutSeedBatchTagIds(): string[] {
  return CANONICAL_CATEGORIES.map((category) =>
    buildTagDocumentId(category.slug, LAYOUT_SEED_BATCH_TAG_SLUG)
  );
}

export function flattenCanonicalTags(): FlatCanonicalTag[] {
  const flat: FlatCanonicalTag[] = [];
  for (const [categorySlug, tags] of Object.entries(CANONICAL_CATEGORY_TAGS)) {
    for (const tag of tags) {
      flat.push({ ...tag, categorySlug });
    }
  }
  return flat;
}

export function getCanonicalCategoryBySlug(slug: string): CanonicalCategory | undefined {
  const normalized = slug.trim().toLowerCase();
  return CANONICAL_CATEGORIES.find((category) => category.slug === normalized);
}

export function validateCanonicalTaxonomy(): void {
  const categorySlugs = new Set<string>();
  const tagSlugs = new Set<string>();
  const categorySlugSet = new Set(CANONICAL_CATEGORIES.map((category) => category.slug));

  for (const category of CANONICAL_CATEGORIES) {
    if (!category.slug.trim() || !category.title.trim()) {
      throw new Error("Canonical categories must have non-empty title and slug");
    }
    if (categorySlugs.has(category.slug)) {
      throw new Error(`Duplicate category slug: ${category.slug}`);
    }
    categorySlugs.add(category.slug);
  }

  for (const categorySlug of Object.keys(CANONICAL_CATEGORY_TAGS)) {
    if (!categorySlugSet.has(categorySlug)) {
      throw new Error(`Tag group references unknown category slug: ${categorySlug}`);
    }
  }

  for (const category of CANONICAL_CATEGORIES) {
    if (!CANONICAL_CATEGORY_TAGS[category.slug]) {
      throw new Error(`Missing canonical tags for category: ${category.slug}`);
    }
  }

  for (const tag of flattenCanonicalTags()) {
    if (!tag.slug.trim() || !tag.title.trim()) {
      throw new Error(`Tag under ${tag.categorySlug} must have non-empty title and slug`);
    }
    if (tagSlugs.has(tag.slug)) {
      throw new Error(`Duplicate global tag slug: ${tag.slug}`);
    }
    tagSlugs.add(tag.slug);
  }
}
