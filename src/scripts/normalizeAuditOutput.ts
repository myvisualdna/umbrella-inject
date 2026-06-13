import * as fs from "fs";
import * as path from "path";
import { canonicalizeUrl, normalizeStoryCandidate } from "../normalization/normalizeStoryCandidate";
import { getSourceMetadata } from "../normalization/sourceMetadata";
import { validateNormalizedCandidate } from "../normalization/validateNormalizedCandidate";
import type {
  DuplicateCandidateRecord,
  NormalizationSummary,
  NormalizedStoryCandidate,
  RawScrapedArticle,
  RejectedCandidate,
  SourceNormalizationSummary,
} from "../normalization/types";

interface ScrapingAuditFile {
  sourceKey?: string;
  displayName?: string;
  articles?: RawScrapedArticle[];
}

const INPUT_DIR = path.join(process.cwd(), "audit-output", "scraping");
const OUTPUT_DIR = path.join(process.cwd(), "audit-output", "normalized");

function listInputFiles(): string[] {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input directory not found: ${INPUT_DIR}`);
  }

  return fs
    .readdirSync(INPUT_DIR)
    .filter((name) => name.endsWith(".json") && name !== "summary.json")
    .sort();
}

function writeJson(fileName: string, data: unknown): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function buildMarkdownReport(summary: NormalizationSummary): string {
  const lines: string[] = [];
  lines.push("# Normalization Audit Report");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Input directory: \`${summary.inputDirectory}\``);
  lines.push(`Output directory: \`${summary.outputDirectory}\``);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Files read: ${summary.filesRead}`);
  lines.push(`- Sources processed: ${summary.sourcesProcessed}`);
  lines.push(`- Raw articles read: ${summary.rawArticlesRead}`);
  lines.push(`- Valid normalized candidates: ${summary.validCandidates}`);
  lines.push(`- Rejected candidates: ${summary.rejectedCandidates}`);
  lines.push(`- Duplicates removed: ${summary.duplicatesRemoved}`);
  lines.push(
    `- Requires legal review (valid candidates): ${summary.legalReviewCounts.requiresLegalReview}`
  );
  lines.push(
    `- No legal review required (valid candidates): ${summary.legalReviewCounts.noLegalReview}`
  );
  lines.push("");
  lines.push("## Per-source summary");
  lines.push("");
  lines.push("| Source | Raw | Valid | Rejected |");
  lines.push("|--------|-----|-------|----------|");
  for (const source of summary.perSource) {
    lines.push(
      `| \`${source.sourceKey}\` | ${source.rawArticles} | ${source.validCandidates} | ${source.rejectedCandidates} |`
    );
  }
  lines.push("");

  lines.push("## Rejection reasons");
  lines.push("");
  if (Object.keys(summary.rejectionReasonCounts).length === 0) {
    lines.push("- None");
  } else {
    for (const [reason, count] of Object.entries(summary.rejectionReasonCounts).sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      lines.push(`- ${reason}: ${count}`);
    }
  }
  lines.push("");

  lines.push("## Duplicate URLs removed");
  lines.push("");
  if (summary.duplicates.length === 0) {
    lines.push("- None");
  } else {
    for (const dup of summary.duplicates) {
      lines.push(
        `- \`${dup.sourceUrl}\` (\`${dup.sourceKey}\`) duplicated \`${dup.keptSourceKey}\``
      );
    }
  }
  lines.push("");
  lines.push("## Supabase readiness");
  lines.push("");
  lines.push(
    summary.validCandidates > 0
      ? "- Normalized output is ready for future Supabase insertion in a later step."
      : "- No valid candidates were produced; fix validation failures before Supabase insertion."
  );
  lines.push("");

  return lines.join("\n");
}

function main(): void {
  const files = listInputFiles();
  const validCandidates: NormalizedStoryCandidate[] = [];
  const rejectedCandidates: RejectedCandidate[] = [];
  const duplicates: DuplicateCandidateRecord[] = [];
  const rejectionReasonCounts: Record<string, number> = {};
  const perSourceSummary = new Map<string, SourceNormalizationSummary>();
  const seenCanonicalUrls = new Map<string, NormalizedStoryCandidate>();

  let rawArticlesRead = 0;
  let requiresLegalReviewCount = 0;
  let noLegalReviewCount = 0;

  for (const fileName of files) {
    const filePath = path.join(INPUT_DIR, fileName);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ScrapingAuditFile;

    const inferredSourceKey = fileName.replace(/\.json$/, "");
    const sourceKey = parsed.sourceKey ?? inferredSourceKey;
    const sourceName = parsed.displayName ?? sourceKey;
    const articles = Array.isArray(parsed.articles) ? parsed.articles : [];

    const sourceSummary: SourceNormalizationSummary = {
      sourceKey,
      sourceName,
      rawArticles: 0,
      validCandidates: 0,
      rejectedCandidates: 0,
    };

    for (const rawArticle of articles) {
      rawArticlesRead += 1;
      sourceSummary.rawArticles += 1;

      const normalized = normalizeStoryCandidate(rawArticle, sourceKey);
      const validation = validateNormalizedCandidate(normalized);

      if (!validation.valid) {
        rejectedCandidates.push({
          candidate: normalized,
          reasons: validation.reasons,
        });
        sourceSummary.rejectedCandidates += 1;
        for (const reason of validation.reasons) {
          rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
        }
        continue;
      }

      const canonicalUrl = canonicalizeUrl(normalized.sourceUrl);
      const kept = seenCanonicalUrls.get(canonicalUrl);
      if (kept) {
        duplicates.push({
          canonicalUrl,
          sourceUrl: normalized.sourceUrl,
          sourceKey: normalized.sourceKey,
          keptSourceKey: kept.sourceKey,
        });
        continue;
      }

      seenCanonicalUrls.set(canonicalUrl, normalized);
      validCandidates.push(normalized);
      sourceSummary.validCandidates += 1;

      const meta = getSourceMetadata(normalized.sourceKey);
      if (meta?.requiresLegalReview) {
        requiresLegalReviewCount += 1;
      } else {
        noLegalReviewCount += 1;
      }
    }

    perSourceSummary.set(sourceKey, sourceSummary);
  }

  const summary: NormalizationSummary = {
    generatedAt: new Date().toISOString(),
    inputDirectory: path.relative(process.cwd(), INPUT_DIR),
    outputDirectory: path.relative(process.cwd(), OUTPUT_DIR),
    filesRead: files.length,
    sourcesProcessed: perSourceSummary.size,
    rawArticlesRead,
    validCandidates: validCandidates.length,
    rejectedCandidates: rejectedCandidates.length,
    duplicatesRemoved: duplicates.length,
    legalReviewCounts: {
      requiresLegalReview: requiresLegalReviewCount,
      noLegalReview: noLegalReviewCount,
    },
    rejectionReasonCounts,
    perSource: [...perSourceSummary.values()].sort((a, b) =>
      a.sourceKey.localeCompare(b.sourceKey)
    ),
    duplicates,
  };

  writeJson("story-candidates.json", validCandidates);
  writeJson("rejected-candidates.json", rejectedCandidates);
  writeJson("summary.json", summary);
  fs.writeFileSync(path.join(OUTPUT_DIR, "NORMALIZATION_AUDIT.md"), buildMarkdownReport(summary), "utf-8");

  console.log("\nNormalization audit complete");
  console.log(`Raw articles read: ${summary.rawArticlesRead}`);
  console.log(`Valid normalized candidates: ${summary.validCandidates}`);
  console.log(`Rejected candidates: ${summary.rejectedCandidates}`);
  console.log(`Duplicates removed: ${summary.duplicatesRemoved}`);
  console.log(`Output: ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

main();
