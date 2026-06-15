import type { SourceKey } from "../config/scrapingControl";
import { canonicalizeUrl } from "../normalization/normalizeStoryCandidate";
import {
  scrapeAPNewsHomepage,
  scrapeAPNewsWorldHomepage,
  scrapeAPNewsPoliticsHomepage,
  scrapeAPNewsBusinessHomepage,
  scrapeAPNewsScienceHomepage,
  scrapeAPNewsTechnologyHomepage,
  scrapeAPNewsLifestyleHomepage,
  scrapeAPNewsEntertainmentHomepage,
} from "../sources/apNewsScraper";
import {
  scrapeYahooUSNews,
  scrapeYahooWorldNews,
  scrapeYahooPoliticsNews,
  scrapeYahooFinanceNews,
  scrapeYahooEntertainmentNews,
  scrapeYahooLifestyleNews,
  scrapeYahooScienceNews,
} from "../sources/yahooNewsScraper";
import { scrapeCBSUSNews } from "../sources/cbsUSScraper";
import { scrapeCBSWorldNews } from "../sources/cbsWorldScraper";
import { scrapeCBSPoliticsNews } from "../sources/cbsPoliticsScraper";
import { scrapeTechCrunchNews } from "../sources/techCrunchScraper";
import { scrapeABCNewsUSHomepage } from "../sources/abcNewsUSScraper";
import { scrapeABCNewsInternationalHomepage } from "../sources/abcNewsInternationalScraper";
import { scrapeABCNewsBusinessHomepage } from "../sources/abcNewsBusinessScraper";
import { scrapeABCNewsTechnologyHomepage } from "../sources/abcNewsTechnologyScraper";

type DiscoveryFn = (limit: number) => Promise<Array<{ url: string; title?: string }>>;

const DISCOVERY_BY_SOURCE: Record<SourceKey, DiscoveryFn> = {
  apNewsUS: scrapeAPNewsHomepage,
  apNewsWorld: scrapeAPNewsWorldHomepage,
  apNewsPolitics: scrapeAPNewsPoliticsHomepage,
  apNewsBusiness: scrapeAPNewsBusinessHomepage,
  apNewsScience: scrapeAPNewsScienceHomepage,
  apNewsTechnology: scrapeAPNewsTechnologyHomepage,
  apNewsLifestyle: scrapeAPNewsLifestyleHomepage,
  apNewsEntertainment: scrapeAPNewsEntertainmentHomepage,
  yahooUSNews: scrapeYahooUSNews,
  yahooWorldNews: scrapeYahooWorldNews,
  yahooPoliticsNews: scrapeYahooPoliticsNews,
  yahooFinanceNews: scrapeYahooFinanceNews,
  yahooEntertainmentNews: scrapeYahooEntertainmentNews,
  yahooLifestyleNews: scrapeYahooLifestyleNews,
  yahooScienceNews: scrapeYahooScienceNews,
  cbsUS: scrapeCBSUSNews,
  cbsWorld: scrapeCBSWorldNews,
  cbsPolitics: scrapeCBSPoliticsNews,
  techCrunch: scrapeTechCrunchNews,
  abcNewsUS: scrapeABCNewsUSHomepage,
  abcNewsInternational: scrapeABCNewsInternationalHomepage,
  abcNewsBusiness: scrapeABCNewsBusinessHomepage,
  abcNewsTechnology: scrapeABCNewsTechnologyHomepage,
};

export interface DiscoveryResult {
  sourceKey: SourceKey;
  discoveryCap: number;
  selectLimit: number;
  rawDiscoveredCount: number;
  discoveredUrls: string[];
  duplicateDiscoveredUrls: string[];
  selectedUrls: string[];
  skippedUrls: string[];
  items: Array<{ url: string; title?: string }>;
}

export async function discoverSourceArticles(
  sourceKey: SourceKey,
  selectLimit: number
): Promise<DiscoveryResult> {
  const discoveryFn = DISCOVERY_BY_SOURCE[sourceKey];
  if (!discoveryFn) {
    throw new Error(`No discovery function configured for source: ${sourceKey}`);
  }

  const discoveryCap = Math.max(selectLimit * 10, 30);
  const rawItems = await discoveryFn(discoveryCap);

  const seen = new Set<string>();
  const duplicateDiscoveredUrls: string[] = [];
  const discoveredUrls: string[] = [];

  for (const item of rawItems) {
    const url = canonicalizeUrl(String(item.url ?? "").trim());
    if (!url) continue;

    if (seen.has(url)) {
      duplicateDiscoveredUrls.push(url);
      continue;
    }

    seen.add(url);
    discoveredUrls.push(url);
  }

  const selectedUrls = discoveredUrls.slice(0, selectLimit);
  const skippedUrls = discoveredUrls.slice(selectLimit);

  return {
    sourceKey,
    discoveryCap,
    selectLimit,
    rawDiscoveredCount: rawItems.length,
    discoveredUrls,
    duplicateDiscoveredUrls,
    selectedUrls,
    skippedUrls,
    items: rawItems.map((item) => ({
      url: canonicalizeUrl(String(item.url ?? "").trim()),
      title: item.title,
    })),
  };
}
