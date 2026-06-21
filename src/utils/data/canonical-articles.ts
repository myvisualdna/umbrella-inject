import {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_TAGS,
  type CanonicalCategory,
} from "./canonical-taxonomy";

export type SeedArticleType = "post" | "analysis" | "opinion";

export interface SeedHomepageFlags {
  mainHeadline?: boolean;
  frontline?: boolean;
  rightHeadline?: boolean;
  justIn?: boolean;
  breakingNews?: boolean;
  developingStory?: boolean;
  featured?: boolean;
}

export interface CanonicalSeedArticle {
  id: string;
  articleType: SeedArticleType;
  title: string;
  slug: string;
  tickerTitle: string;
  excerpt: string;
  bodyParagraphs: string[];
  publishedAtOffsetHours: number;
  categorySlug?: string;
  tagSlugs?: string[];
  analysisFocus?: string;
  disclosure?: string;
  homepage?: SeedHomepageFlags;
}

const DEFAULT_BODY = [
  "Officials described the development as significant for communities watching policy shifts closely.",
  "Agencies said they would release additional details as reviews continue through the week.",
  "Local leaders noted that implementation timelines could vary by region and agency capacity.",
];

const OPINION_ARTICLES: Omit<CanonicalSeedArticle, "publishedAtOffsetHours">[] = [
  {
    id: "opinion.seed.001",
    articleType: "opinion",
    title: "Why civic institutions need clearer guardrails in a faster news cycle",
    slug: "civic-institutions-need-clearer-guardrails",
    tickerTitle: "Clearer civic guardrails needed",
    excerpt:
      "Public trust improves when institutions explain decisions early, even when the full picture is still emerging.",
    bodyParagraphs: [
      "Readers deserve plain-language explanations when policy changes affect daily life.",
      "When agencies wait too long to clarify intent, rumors fill the gap and trust erodes quickly.",
      "A simple standard—early context, transparent updates, and named sources—would help every beat.",
    ],
    disclosure: "The author consults for a nonprofit focused on local journalism sustainability.",
  },
  {
    id: "opinion.seed.002",
    articleType: "opinion",
    title: "Commuter corridors deserve funding before the next infrastructure crunch",
    slug: "commuter-corridors-deserve-funding-now",
    tickerTitle: "Fund commuter corridors now",
    excerpt:
      "Delaying maintenance on busy corridors shifts costs to riders and small businesses along those routes.",
    bodyParagraphs: DEFAULT_BODY,
    disclosure: "The author serves on a regional transit advisory board in a volunteer capacity.",
  },
  {
    id: "opinion.seed.003",
    articleType: "opinion",
    title: "School districts should publish clearer timelines for classroom technology upgrades",
    slug: "school-districts-technology-upgrade-timelines",
    tickerTitle: "Schools need tech timelines",
    excerpt:
      "Families and teachers make plans based on district commitments that often arrive without schedules.",
    bodyParagraphs: DEFAULT_BODY,
  },
  {
    id: "opinion.seed.004",
    articleType: "opinion",
    title: "Small retailers need predictable trade rules to plan inventory",
    slug: "small-retailers-need-predictable-trade-rules",
    tickerTitle: "Retailers want trade predictability",
    excerpt:
      "Independent shops absorb tariff and supply shocks faster than national chains with hedging teams.",
    bodyParagraphs: DEFAULT_BODY,
    disclosure: "The author previously advised a regional business association on trade policy.",
  },
];

function uniqueTags(categorySlug: string, slugs: string[]): string[] {
  const allowed = new Set((CANONICAL_CATEGORY_TAGS[categorySlug] ?? []).map((tag) => tag.slug));
  const out: string[] = [];
  for (const slug of slugs) {
    if (allowed.has(slug) && !out.includes(slug)) {
      out.push(slug);
    }
  }
  return out;
}

function postTemplate(
  category: CanonicalCategory,
  index: number,
  tagSlugs: string[],
  title: string,
  slug: string,
  tickerTitle: string,
  excerpt: string,
  homepage?: SeedHomepageFlags
): Omit<CanonicalSeedArticle, "publishedAtOffsetHours"> {
  return {
    id: `post.seed.${category.slug}.${String(index).padStart(3, "0")}`,
    articleType: "post",
    categorySlug: category.slug,
    tagSlugs: uniqueTags(category.slug, tagSlugs),
    title,
    slug,
    tickerTitle,
    excerpt,
    bodyParagraphs: DEFAULT_BODY,
    homepage,
  };
}

function analysisTemplate(
  category: CanonicalCategory,
  tagSlugs: string[],
  title: string,
  slug: string,
  tickerTitle: string,
  excerpt: string,
  analysisFocus: string
): Omit<CanonicalSeedArticle, "publishedAtOffsetHours"> {
  return {
    id: `analysis.seed.${category.slug}.001`,
    articleType: "analysis",
    categorySlug: category.slug,
    tagSlugs: uniqueTags(category.slug, tagSlugs),
    title,
    slug,
    tickerTitle,
    excerpt,
    bodyParagraphs: DEFAULT_BODY,
    analysisFocus,
  };
}

function buildCategoryArticles(
  category: CanonicalCategory,
  startOffsetIndex: number
): CanonicalSeedArticle[] {
  const tags = CANONICAL_CATEGORY_TAGS[category.slug] ?? [];
  const t = (i: number) => tags[i % tags.length]?.slug ?? tags[0]?.slug ?? "";

  const templates: Record<
    string,
    {
      posts: Array<Omit<CanonicalSeedArticle, "publishedAtOffsetHours">>;
      analysis: Omit<CanonicalSeedArticle, "publishedAtOffsetHours">;
    }
  > = {
    us: {
      posts: [
        postTemplate(
          category,
          1,
          [t(0), t(1)],
          "Federal agencies outline next steps after storm readiness review",
          "federal-agencies-storm-readiness-review",
          "Agencies detail storm readiness steps",
          "Emergency planners said updated guidance could reach counties within days.",
          { mainHeadline: true }
        ),
        postTemplate(
          category,
          2,
          [t(2), t(3)],
          "School districts weigh new safety protocols after statewide audit",
          "school-districts-safety-protocol-audit",
          "Districts review safety protocols",
          "Administrators said the audit highlighted gaps in communication during emergencies."
        ),
        postTemplate(
          category,
          3,
          [t(4), t(5)],
          "Regional forecasters track late-season weather pattern shift",
          "regional-forecasters-weather-pattern-shift",
          "Forecasters track weather pattern shift",
          "Meteorologists said the pattern could bring heavier rainfall to several river basins."
        ),
      ],
      analysis: analysisTemplate(
        category,
        [t(0), t(1)],
        "How federal response timelines affect local emergency planning",
        "federal-response-timelines-local-planning",
        "Federal timelines shape local planning",
        "A look at how guidance delays ripple through county emergency offices.",
        "Explains coordination gaps between federal guidance and local execution."
      ),
    },
    world: {
      posts: [
        postTemplate(
          category,
          1,
          ["china", t(1)],
          "Beijing signals policy adjustments ahead of regional trade talks",
          "beijing-signals-policy-adjustments-trade-talks",
          "Beijing signals policy adjustments",
          "Officials said negotiators would focus on supply chains and cross-border investment rules.",
          { frontline: true }
        ),
        postTemplate(
          category,
          2,
          [t(2), t(3)],
          "European leaders convene emergency session on energy pricing",
          "european-leaders-emergency-energy-pricing",
          "Europe holds emergency energy session",
          "Ministers said they would review short-term measures for households facing higher bills."
        ),
        postTemplate(
          category,
          3,
          [t(4)],
          "Latin American exporters seek clarity on new port inspection rules",
          "latin-american-exporters-port-inspection-rules",
          "Exporters seek port rule clarity",
          "Trade groups asked for phased implementation to avoid shipment backlogs."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["china", "europe"],
        "What shifting supply routes mean for global manufacturing hubs",
        "shifting-supply-routes-manufacturing-hubs",
        "Supply route shifts hit manufacturing",
        "Factories are rerouting components as regional trade rules evolve.",
        "Explains how rerouted supply chains affect factory lead times."
      ),
    },
    politics: {
      posts: [
        postTemplate(
          category,
          1,
          ["white-house", "congress"],
          "White House prepares legislative push after bipartisan budget talks",
          "white-house-legislative-push-budget-talks",
          "White House prepares legislative push",
          "Advisers said the package would prioritize funding deadlines and agency operations.",
          { rightHeadline: true }
        ),
        postTemplate(
          category,
          2,
          ["congress", "elections"],
          "Congressional leaders schedule hearings on border processing capacity",
          "congress-hearings-border-processing-capacity",
          "Congress schedules border hearings",
          "Committee chairs said testimony would include state officials and agency inspectors."
        ),
        postTemplate(
          category,
          3,
          ["immigration", "supreme-court"],
          "Supreme Court calendar sets up major docket decisions this term",
          "supreme-court-calendar-major-docket-decisions",
          "High court calendar fills with key cases",
          "Court watchers said several cases could affect enforcement standards nationwide."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["immigration", "white-house"],
        "How enforcement guidance changes reshape border agency workflows",
        "enforcement-guidance-border-agency-workflows",
        "Guidance shifts reshape border workflows",
        "Agency memos are changing how field offices prioritize cases.",
        "Explains operational effects of shifting federal enforcement guidance."
      ),
    },
    business: {
      posts: [
        postTemplate(
          category,
          1,
          ["markets", "economy"],
          "Markets steady after mixed earnings from major retailers",
          "markets-steady-mixed-retail-earnings",
          "Markets steady after retail earnings",
          "Investors weighed consumer spending data against higher financing costs.",
          { featured: true }
        ),
        postTemplate(
          category,
          2,
          ["finance", "inflation"],
          "Banks update lending standards as inflation readings cool slightly",
          "banks-update-lending-standards-inflation",
          "Banks tighten lending standards",
          "Lenders said they would monitor household debt levels through the quarter."
        ),
        postTemplate(
          category,
          3,
          ["tariffs", "real-estate"],
          "Developers pause projects as mortgage rates fluctuate regionally",
          "developers-pause-projects-mortgage-rates",
          "Developers pause projects amid rates",
          "Builders cited uncertain demand in suburban markets as a key factor."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["economy", "markets"],
        "What recent tariff announcements mean for Midwest factory orders",
        "tariff-announcements-midwest-factory-orders",
        "Tariff shifts hit Midwest factories",
        "Purchasing managers report longer lead times for imported components.",
        "Explains how tariff changes affect regional manufacturing orders."
      ),
    },
    science: {
      posts: [
        postTemplate(
          category,
          1,
          ["space", "climate"],
          "NASA teams preview upcoming launch window for Earth observation mission",
          "nasa-preview-earth-observation-launch",
          "NASA previews observation launch",
          "Scientists said the mission would improve drought and storm tracking models."
        ),
        postTemplate(
          category,
          2,
          ["life-sciences", "climate"],
          "Researchers publish findings on coastal ecosystem recovery rates",
          "researchers-coastal-ecosystem-recovery",
          "Study tracks coastal ecosystem recovery",
          "The team said recovery varied sharply depending on local conservation efforts."
        ),
        postTemplate(
          category,
          3,
          ["climate"],
          "City planners test new heat mitigation strategies ahead of summer",
          "city-planners-heat-mitigation-strategies",
          "Cities test heat mitigation plans",
          "Pilot programs include expanded tree canopy targets and cooling center maps."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["climate", "life-sciences"],
        "How satellite data changes drought forecasting for farm regions",
        "satellite-data-drought-forecasting-farms",
        "Satellite data aids drought forecasts",
        "New instruments provide weekly soil moisture snapshots at higher resolution.",
        "Explains how improved satellite coverage affects agricultural planning."
      ),
    },
    entertainment: {
      posts: [
        postTemplate(
          category,
          1,
          ["movies", "celebrity"],
          "Studios shift release calendars after strong festival debut weekend",
          "studios-shift-release-calendars-festival-debut",
          "Studios shift release calendars",
          "Distribution executives said streaming windows would remain flexible this season."
        ),
        postTemplate(
          category,
          2,
          ["television", "music"],
          "Streaming platforms renew flagship series amid subscriber competition",
          "streaming-platforms-renew-flagship-series",
          "Streamers renew flagship series",
          "Programming chiefs said retention costs are rising across major platforms."
        ),
        postTemplate(
          category,
          3,
          ["fashion"],
          "Design houses expand fall collections with sustainability-focused materials",
          "design-houses-sustainability-focused-materials",
          "Design houses expand fall collections",
          "Buyers said consumer demand for durable materials continues to climb."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["movies", "television"],
        "What changing box office patterns mean for theater chains",
        "changing-box-office-patterns-theater-chains",
        "Box office shifts affect theaters",
        "Regional chains are adjusting showtimes as audience habits evolve.",
        "Explains how ticket sales trends affect regional theater operations."
      ),
    },
    tech: {
      posts: [
        postTemplate(
          category,
          1,
          ["artificial-intelligence"],
          "Companies roll out new artificial intelligence tools for customer support teams",
          "companies-roll-out-ai-customer-support-tools",
          "Firms roll out AI support tools",
          "Vendors said the tools would include stronger audit logs for enterprise clients.",
          { justIn: true, breakingNews: true }
        ),
        postTemplate(
          category,
          2,
          ["social-media", "artificial-intelligence"],
          "Platforms test stricter moderation workflows after policy updates",
          "platforms-test-stricter-moderation-workflows",
          "Platforms test stricter moderation",
          "Policy teams said the changes would roll out gradually by region."
        ),
        postTemplate(
          category,
          3,
          ["social-media"],
          "Developers push for clearer app store rules on data collection",
          "developers-push-clearer-app-store-data-rules",
          "Developers seek clearer app store rules",
          "Industry groups asked for standardized disclosure templates for users."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["artificial-intelligence", "social-media"],
        "How enterprise AI contracts are changing software procurement",
        "enterprise-ai-contracts-software-procurement",
        "Enterprise AI contracts evolve",
        "Buyers are adding liability and audit clauses to vendor agreements.",
        "Explains procurement shifts as organizations adopt AI systems."
      ),
    },
    lifestyle: {
      posts: [
        postTemplate(
          category,
          1,
          ["food", "travel"],
          "Chefs launch seasonal menus highlighting regional farm partnerships",
          "chefs-seasonal-menus-regional-farm-partnerships",
          "Chefs launch seasonal farm menus",
          "Restaurants said shorter supply chains helped stabilize menu pricing."
        ),
        postTemplate(
          category,
          2,
          ["health", "beauty"],
          "Wellness brands expand dermatologist-backed product lines",
          "wellness-brands-dermatologist-backed-products",
          "Wellness brands expand product lines",
          "Retailers reported strong demand for simplified ingredient labels."
        ),
        postTemplate(
          category,
          3,
          ["culture"],
          "Community festivals return with expanded local artist programs",
          "community-festivals-local-artist-programs",
          "Festivals expand local artist programs",
          "Organizers said attendance caps would remain in place for peak weekends."
        ),
      ],
      analysis: analysisTemplate(
        category,
        ["travel", "food"],
        "What shorter booking windows mean for regional tourism operators",
        "shorter-booking-windows-regional-tourism",
        "Booking windows shrink for tourism",
        "Operators are adjusting staffing as travelers book closer to trip dates.",
        "Explains how booking behavior changes affect regional tourism businesses."
      ),
    },
  };

  const bundle = templates[category.slug];
  if (!bundle) {
    throw new Error(`Missing seed templates for category: ${category.slug}`);
  }

  const articles: CanonicalSeedArticle[] = [];
  let offset = startOffsetIndex;

  for (const post of bundle.posts) {
    articles.push({ ...post, publishedAtOffsetHours: computeOffsetHours(offset) });
    offset += 1;
  }

  articles.push({
    ...bundle.analysis,
    publishedAtOffsetHours: computeOffsetHours(offset),
  });

  return articles;
}

/** Spread publication times across the last 14 days; index 0 is most recent. */
export function computeOffsetHours(index: number): number {
  if (index === 0) return 2;
  if (index === 1) return 5;
  if (index === 2) return 10;
  const maxHours = 14 * 24;
  const step = Math.floor(maxHours / 36);
  return Math.min(maxHours, 10 + index * step);
}

export function buildCanonicalSeedArticles(): CanonicalSeedArticle[] {
  const articles: CanonicalSeedArticle[] = [];
  let offsetIndex = 0;

  for (const category of CANONICAL_CATEGORIES) {
    const categoryArticles = buildCategoryArticles(category, offsetIndex);
    articles.push(...categoryArticles);
    offsetIndex += categoryArticles.length;
  }

  for (let i = 0; i < OPINION_ARTICLES.length; i++) {
    articles.push({
      ...OPINION_ARTICLES[i],
      publishedAtOffsetHours: computeOffsetHours(offsetIndex + i),
    });
  }

  return articles;
}

export const CANONICAL_SEED_ARTICLES: CanonicalSeedArticle[] = buildCanonicalSeedArticles();

export const SEED_AUTHOR_ID = "author.angle-staff";
