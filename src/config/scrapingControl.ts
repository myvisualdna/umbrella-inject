import type { ScraperSwitches } from "./scraperSwitches";

export type SourceKey = keyof ScraperSwitches;

export interface RunSourceConfig {
  source: SourceKey;
  count: number;
}

export interface RunConfig {
  id: "run1" | "run2" | "run3" | "run4";
  label: string;
  enabled: boolean;
  sources: RunSourceConfig[];
}

/**
 * Run activation switches
 * Set to true to enable a run, false to disable
 * Modify these values to easily control which runs are active
 */
export const runSwitches = {
  run1: true, // Morning Run - Set to false to disable
  run2: false, // Midday Run - Set to false to disable
  run3: false, // Evening Run - Set to false to disable
  run4: false, // Late Run - Set to false to disable
};

export const SCRAPING_RUNS: RunConfig[] = [
  {
    id: "run1",
    label: "Morning Run",
    enabled: runSwitches.run1,
    sources: [
      { source: "apNewsUS", count: 2 },
      { source: "yahooUSNews", count: 1 },
      { source: "apNewsWorld", count: 1 },
      { source: "yahooWorldNews", count: 1 },
      { source: "apNewsPolitics", count: 2 },
      { source: "apNewsBusiness", count: 1 },
    ],
  },
  {
    id: "run2",
    label: "Midday Run",
    enabled: runSwitches.run2,
    sources: [
      { source: "apNewsBusiness", count: 1 },
      { source: "cbsUS", count: 1 },
      { source: "yahooPoliticsNews", count: 1 },
      { source: "apNewsWorld", count: 1 },
      { source: "cbsWorld", count: 1 },
      { source: "techCrunch", count: 1 },
      { source: "yahooFinanceNews", count: 1 },
      { source: "yahooEntertainmentNews", count: 1 },
      { source: "abcNewsInternational", count: 1 },
      { source: "abcNewsTechnology", count: 1 },
    ],
  },
  {
    id: "run3",
    label: "Evening Run",
    enabled: runSwitches.run3,
    sources: [
      { source: "apNewsUS", count: 1 },
      { source: "yahooEntertainmentNews", count: 1 },
      { source: "cbsUS", count: 1 },
      { source: "cbsWorld", count: 1 },
      { source: "apNewsBusiness", count: 1 },
      { source: "yahooScienceNews", count: 1 },
      { source: "yahooLifestyleNews", count: 1 },
      { source: "abcNewsUS", count: 1 },
    ],
  },
  {
    id: "run4",
    label: "Late Run",
    enabled: runSwitches.run4,
    sources: [
      { source: "yahooEntertainmentNews", count: 1 },
      { source: "apNewsScience", count: 1 },
      { source: "apNewsLifestyle", count: 1 },
      { source: "yahooWorldNews", count: 1 },
    ],
  },
];

/**
 * Check if a run is enabled
 */
export function isRunEnabled(runId: RunConfig["id"]): boolean {
  const run = SCRAPING_RUNS.find((r) => r.id === runId);
  return run ? run.enabled : false;
}

