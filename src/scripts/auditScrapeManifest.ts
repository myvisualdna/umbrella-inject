import type { SourceKey } from "../config/scrapingControl";

export type ReadinessStatus =
  | "ready"
  | "needs minor fixes"
  | "needs major fixes"
  | "disable for MVP";

export interface AuditSourceManifestEntry {
  sourceKey: SourceKey;
  displayName: string;
  sectionUrl: string;
  wrapperPath: string;
  sourcePath: string;
  extractionMethod: string;
  tosRisk: "low" | "medium" | "high";
}

export const AUDIT_SOURCE_MANIFEST: AuditSourceManifestEntry[] = [
  {
    sourceKey: "apNewsUS",
    displayName: "AP News US",
    sectionUrl: "https://apnews.com/us-news",
    wrapperPath: "src/scrapers/apnews/us.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsWorld",
    displayName: "AP News World",
    sectionUrl: "https://apnews.com/world-news",
    wrapperPath: "src/scrapers/apnews/world.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsPolitics",
    displayName: "AP News Politics",
    sectionUrl: "https://apnews.com/politics",
    wrapperPath: "src/scrapers/apnews/politics.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsBusiness",
    displayName: "AP News Business",
    sectionUrl: "https://apnews.com/business",
    wrapperPath: "src/scrapers/apnews/business.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsScience",
    displayName: "AP News Science",
    sectionUrl: "https://apnews.com/science",
    wrapperPath: "src/scrapers/apnews/science.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsTechnology",
    displayName: "AP News Technology",
    sectionUrl: "https://apnews.com/technology",
    wrapperPath: "src/scrapers/apnews/technology.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsLifestyle",
    displayName: "AP News Lifestyle",
    sectionUrl: "https://apnews.com/lifestyle",
    wrapperPath: "src/scrapers/apnews/lifestyle.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "apNewsEntertainment",
    displayName: "AP News Entertainment",
    sectionUrl: "https://apnews.com/entertainment",
    wrapperPath: "src/scrapers/apnews/entertainment.ts",
    sourcePath: "src/sources/apNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooUSNews",
    displayName: "Yahoo News US",
    sectionUrl: "https://www.yahoo.com/news/us/",
    wrapperPath: "src/scrapers/yahoo/us.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooWorldNews",
    displayName: "Yahoo News World",
    sectionUrl: "https://www.yahoo.com/news/world/",
    wrapperPath: "src/scrapers/yahoo/world.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooPoliticsNews",
    displayName: "Yahoo News Politics",
    sectionUrl: "https://www.yahoo.com/news/politics/",
    wrapperPath: "src/scrapers/yahoo/politics.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooFinanceNews",
    displayName: "Yahoo Finance",
    sectionUrl: "https://finance.yahoo.com/",
    wrapperPath: "src/scrapers/yahoo/finance.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooEntertainmentNews",
    displayName: "Yahoo Entertainment",
    sectionUrl: "https://www.yahoo.com/entertainment/",
    wrapperPath: "src/scrapers/yahoo/entertainment.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooLifestyleNews",
    displayName: "Yahoo Lifestyle",
    sectionUrl: "https://www.yahoo.com/lifestyle/",
    wrapperPath: "src/scrapers/yahoo/lifestyle.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "yahooScienceNews",
    displayName: "Yahoo Science",
    sectionUrl: "https://www.yahoo.com/news/science/",
    wrapperPath: "src/scrapers/yahoo/science.ts",
    sourcePath: "src/sources/yahooNewsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "high",
  },
  {
    sourceKey: "cbsUS",
    displayName: "CBS News US",
    sectionUrl: "https://www.cbsnews.com/us/",
    wrapperPath: "src/scrapers/cbs/us.ts",
    sourcePath: "src/sources/cbsUSScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "cbsWorld",
    displayName: "CBS News World",
    sectionUrl: "https://www.cbsnews.com/world/",
    wrapperPath: "src/scrapers/cbs/world.ts",
    sourcePath: "src/sources/cbsWorldScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "cbsPolitics",
    displayName: "CBS News Politics",
    sectionUrl: "https://www.cbsnews.com/politics/",
    wrapperPath: "src/scrapers/cbs/politics.ts",
    sourcePath: "src/sources/cbsPoliticsScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "techCrunch",
    displayName: "TechCrunch",
    sectionUrl: "https://techcrunch.com/",
    wrapperPath: "src/scrapers/techcrunch/index.ts",
    sourcePath: "src/sources/techCrunchScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "abcNewsUS",
    displayName: "ABC News US",
    sectionUrl: "https://abcnews.com/US",
    wrapperPath: "src/scrapers/abcnews/us.ts",
    sourcePath: "src/sources/abcNewsUSScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "abcNewsInternational",
    displayName: "ABC News International",
    sectionUrl: "https://abcnews.com/International",
    wrapperPath: "src/scrapers/abcnews/world.ts",
    sourcePath: "src/sources/abcNewsInternationalScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "abcNewsBusiness",
    displayName: "ABC News Business",
    sectionUrl: "https://abcnews.com/Business",
    wrapperPath: "src/scrapers/abcnews/business.ts",
    sourcePath: "src/sources/abcNewsBusinessScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
  {
    sourceKey: "abcNewsTechnology",
    displayName: "ABC News Technology",
    sectionUrl: "https://abcnews.com/Technology",
    wrapperPath: "src/scrapers/abcnews/technology.ts",
    sourcePath: "src/sources/abcNewsTechnologyScraper.ts",
    extractionMethod: "HTML + JSON-LD + CSS selectors",
    tosRisk: "medium",
  },
];

export function getManifestEntry(sourceKey: SourceKey): AuditSourceManifestEntry {
  const entry = AUDIT_SOURCE_MANIFEST.find((e) => e.sourceKey === sourceKey);
  if (!entry) {
    throw new Error(`No audit manifest entry for source: ${sourceKey}`);
  }
  return entry;
}
