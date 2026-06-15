import { SCRAPING_RUNS } from "../config/scrapingControl";
import { runFetcherBatch } from "../fetcherWorker/runFetcherBatch";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const run = SCRAPING_RUNS.find((entry) => entry.id === "run1");
  if (!run) {
    throw new Error("run1 not found in SCRAPING_RUNS");
  }

  const result = await runFetcherBatch(run, {
    dryRun: true,
    writeEnabled: false,
    sourceKeysFilter: null,
    maxTotalArticles: Number.parseInt(process.env.FETCHER_VERIFY_MAX_TOTAL_ARTICLES || "3", 10),
  });

  assert(result.dryRun === true, "Expected dryRun=true");
  assert(result.supabaseUpdated === false, "Expected supabaseUpdated=false in dry-run");
  assert(result.openAiCalled === false, "Expected openAiCalled=false");
  assert(result.sanityCalled === false, "Expected sanityCalled=false");
  assert(result.legacyMiddlewareCalled === false, "Expected legacyMiddlewareCalled=false");
  assert(result.legacyGunnerCalled === false, "Expected legacyGunnerCalled=false");

  console.log("verifyFetcherWorker: PASS");
  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        dryRun: result.dryRun,
        sourcesSelected: result.sourcesSelected.length,
        scrapedArticlesCount: result.scrapedArticlesCount,
        normalizedValidCount: result.normalizedValidCount,
        rejectedCount: result.rejectedCount,
        duplicateCount: result.duplicateCount,
        candidatesInserted: result.candidatesInserted,
        supabaseUpdated: result.supabaseUpdated,
        openAiCalled: result.openAiCalled,
        sanityCalled: result.sanityCalled,
        legacyMiddlewareCalled: result.legacyMiddlewareCalled,
        legacyGunnerCalled: result.legacyGunnerCalled,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`verifyFetcherWorker: FAIL - ${message}`);
  process.exit(1);
});
