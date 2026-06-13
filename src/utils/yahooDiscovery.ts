import * as cheerio from "cheerio";

type CheerioRoot = ReturnType<typeof cheerio.load>;

export type YahooNewsSection = "us" | "world" | "politics";

export interface YahooArticleListItem {
  title: string;
  url: string;
  imageUrl?: string;
}

const EXCLUDED_TEXTS = [
  "today's news",
  "newsletters",
  "weather news",
  "sign up",
  "more in",
  "follow us",
  "subscribe",
  "newsletter",
  "tariff updates",
  "live updates",
  "watch now",
  "trending",
  "most active",
  "top gainers",
  "top losers",
];

const CATEGORY_PREFIXES = [
  "politics",
  "us",
  "world",
  "business",
  "technology",
  "entertainment",
  "sports",
  "health",
  "science",
  "finance",
];

const SOURCE_NAMES = [
  "associated press",
  "ap",
  "reuters",
  "the guardian",
  "cbs news",
  "cnn",
  "nbc news",
  "abc news",
  "fox news",
  "the hill",
  "politico",
  "bloomberg",
  "the washington post",
  "the new york times",
  "usa today",
  "time",
  "newsweek",
  "the atlantic",
  "axios",
  "bbc",
  "yahoo finance",
  "yahoo personal finance",
  "yahoo entertainment",
  "yahoo movies",
];

const SECTION_ARTICLE_PATH: Record<YahooNewsSection, RegExp> = {
  us: /yahoo\.com\/news\/us\/articles\/.+\d+/i,
  world: /yahoo\.com\/news\/world\/articles\/.+\d+/i,
  politics: /yahoo\.com\/news\/politics\/articles\/.+\d+/i,
};

const LEGACY_ARTICLE_PATH = /yahoo\.com\/news\/articles\/.+\d+/i;

export function isYahooNewsSectionArticleUrl(
  url: string,
  section: YahooNewsSection
): boolean {
  if (!url.includes("www.yahoo.com") && !url.includes("yahoo.com/news")) {
    return false;
  }
  if (
    url.includes("finance.yahoo.com") ||
    url.includes("shopping.yahoo.com") ||
    url.includes("health.yahoo.com") ||
    url.includes("sports.yahoo.com")
  ) {
    return false;
  }
  if (url.endsWith("/") || /\/news\/(world|us|politics|entertainment|science)\/?$/.test(url)) {
    return false;
  }
  if (url.includes("/newsletters/")) return false;

  return SECTION_ARTICLE_PATH[section].test(url) || LEGACY_ARTICLE_PATH.test(url);
}

function cleanYahooListTitle(title: string): string {
  let cleanedTitle = title;

  for (const category of CATEGORY_PREFIXES) {
    for (const source of SOURCE_NAMES) {
      const pattern1 = new RegExp(
        `^${category}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z][a-z].+)`,
        "i"
      );
      const match1 = cleanedTitle.match(pattern1);
      if (match1?.[1] && match1[1].length > 10) {
        cleanedTitle = match1[1].trim();
        break;
      }

      const pattern2 = new RegExp(
        `^${category.toUpperCase()}(?:\\s*)?${source.replace(/\s+/g, "\\s*")}([A-Z'"].+)`,
        "i"
      );
      const match2 = cleanedTitle.match(pattern2);
      if (match2?.[1] && match2[1].length > 10) {
        cleanedTitle = match2[1].trim().replace(/^['"]+|['"]+$/g, "").trim();
        break;
      }
    }
    if (cleanedTitle !== title && cleanedTitle.length > 10) break;
  }

  if (cleanedTitle === title) {
    for (const category of CATEGORY_PREFIXES) {
      if (cleanedTitle.toLowerCase().startsWith(category.toLowerCase())) {
        const afterCategory = cleanedTitle.substring(category.length).trim();
        let foundSource = false;
        for (const source of SOURCE_NAMES) {
          if (afterCategory.toLowerCase().startsWith(source.toLowerCase())) {
            const afterSource = afterCategory.substring(source.length).trim();
            if (afterSource.length > 10 && /^[A-Z'"]/.test(afterSource)) {
              cleanedTitle = afterSource.replace(/^['"]+|['"]+$/g, "").trim();
              foundSource = true;
              break;
            }
          }
        }
        if (!foundSource && afterCategory.length > 10 && /^[A-Z'"]/.test(afterCategory)) {
          cleanedTitle = afterCategory.replace(/^['"]+|['"]+$/g, "").trim();
        }
        break;
      }
    }
  }

  if (cleanedTitle === title || cleanedTitle.length < 10) {
    const titleMatch = title.match(/([A-Z][A-Za-z'"]+(?:\s+[A-Za-z'"]+){2,})/);
    if (titleMatch?.[1]) {
      const potentialTitle = titleMatch[1].trim();
      const isSource = SOURCE_NAMES.some((s) =>
        potentialTitle.toLowerCase().includes(s.toLowerCase())
      );
      if (!isSource && potentialTitle.length > 15) {
        cleanedTitle = potentialTitle;
      }
    }
  }

  return cleanedTitle.length >= 10 ? cleanedTitle : title;
}

export function discoverYahooNewsSectionArticles(
  $: CheerioRoot,
  baseUrl: string,
  section: YahooNewsSection,
  limit: number
): YahooArticleListItem[] {
  const seenUrls = new Set<string>();
  const allArticleLinks: Array<{
    url: string;
    title: string;
    imageUrl?: string;
    domIndex: number;
  }> = [];
  let domIndex = 0;

  const linkSelector = `a[href*="/news/${section}/articles/"], a[href*="/news/articles/"]`;

  $(linkSelector).each((_, link) => {
    const $link = $(link);
    const rawHref = $link.attr("href");

    if (!rawHref || rawHref.includes("#") || rawHref.includes("javascript:")) {
      return;
    }

    let url: string;
    try {
      url = rawHref.startsWith("http")
        ? rawHref
        : new URL(rawHref, baseUrl).toString();
    } catch {
      return;
    }

    if (!isYahooNewsSectionArticleUrl(url, section) || seenUrls.has(url)) {
      return;
    }

    const $closestContainer = $link.closest(
      "aside, nav, .sidebar, [role='complementary'], [role='navigation'], header, footer"
    );
    if ($closestContainer.length > 0) {
      return;
    }

    let title = $link.text().trim();
    if (!title || title.length < 10) {
      const $parent = $link.closest("article, li, div, h2, h3, h4");
      const $titleEl = $parent
        .find(
          "h2, h3, h4, h5, .caas-title, [data-module='Article'] h2, .caas-item-title, .js-stream-content h3"
        )
        .first();
      if ($titleEl.length === 0) {
        title = $parent.filter("h2, h3, h4, h5").text().trim();
      } else {
        title = $titleEl.text().trim();
      }
    }

    title = cleanYahooListTitle(title);
    if (!title || title.length < 10) return;

    const titleLower = title.toLowerCase();
    if (EXCLUDED_TEXTS.some((excluded) => titleLower.includes(excluded))) {
      return;
    }

    const skipPatterns = [
      "read more",
      "see all",
      "view all",
      "more stories",
      "trending",
      "popular",
    ];
    if (skipPatterns.some((pattern) => titleLower.includes(pattern))) {
      return;
    }

    seenUrls.add(url);

    const $parent = $link.closest("article, li, div");
    const $img = $parent.find("img").first();
    const imageUrl =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-original") ||
      undefined;

    allArticleLinks.push({ url, title, imageUrl, domIndex: domIndex++ });
  });

  return allArticleLinks
    .sort((a, b) => a.domIndex - b.domIndex)
    .slice(0, limit)
    .map(({ title, url, imageUrl }) => ({ title, url, imageUrl }));
}
