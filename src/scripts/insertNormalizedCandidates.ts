import * as fs from "fs";
import * as path from "path";
import { parseEnabledSourceKeys, isSourceEnabled } from "../config/ingestionSources";
import {
  getExistingSourceUrls,
  insertStoryCandidates,
  validateForInsert,
} from "../db/storyCandidates";
import { hasSupabaseEnv } from "../db/supabaseClient";
import { getSourceMetadata } from "../normalization/sourceMetadata";
import type { NormalizedStoryCandidate } from "../normalization/types";

type Mode = "dry-run" | "insert";

interface RejectedRecord {
  sourceKey: string;
  sourceUrl: string;
  reasons: string[];
}

interface InsertAuditSummary {
  mode: Mode;
  generatedAt: string;
  inputPath: string;
  reportsDirectory: string;
  candidatesRead: number;
  candidatesValid: number;
  inserted: number;
  duplicates: number;
  skippedBySourceAllowlist: number;
  skippedBySourceKey: Record<string, number>;
  rejectedByValidation: number;
  rejectionReasons: Record<string, number>;
  failedInserts: number;
  failedInsertRecords: Array<{ sourceUrl: string; reason: string }>;
  legalReview: {
    allowedCandidatesMarkedForLegalReview: number;
    allowedCandidatesWithoutLegalReview: number;
  };
}

const INPUT_PATH = path.join(
  process.cwd(),
  "audit-output",
  "normalized",
  "story-candidates.json"
);
const OUTPUT_DIR = path.join(process.cwd(), "audit-output", "supabase-insert");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "summary.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "INSERT_AUDIT.md");

function parseMode(argv: string[]): Mode {
  return argv.includes("--insert") ? "insert" : "dry-run";
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function readCandidates(): NormalizedStoryCandidate[] {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  const parsed = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid input file format: ${INPUT_PATH}`);
  }
  return parsed as NormalizedStoryCandidate[];
}

function writeOutputs(summary: InsertAuditSummary, rejected: RejectedRecord[]): void {
  ensureOutputDir();
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify({ summary, rejected }, null, 2), "utf-8");

  const lines: string[] = [];
  lines.push("# Supabase Insert Audit");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Mode: ${summary.mode}`);
  lines.push(`Input: \`${summary.inputPath}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Candidates read: ${summary.candidatesRead}`);
  lines.push(`- Valid candidates: ${summary.candidatesValid}`);
  lines.push(`- Inserted: ${summary.inserted}`);
  lines.push(`- Duplicates: ${summary.duplicates}`);
  lines.push(`- Skipped by source allowlist: ${summary.skippedBySourceAllowlist}`);
  lines.push(`- Rejected by validation: ${summary.rejectedByValidation}`);
  lines.push(`- Failed inserts: ${summary.failedInserts}`);
  lines.push("");
  lines.push("## Legal review flags");
  lines.push("");
  lines.push(
    `- Allowed candidates marked for legal review: ${summary.legalReview.allowedCandidatesMarkedForLegalReview}`
  );
  lines.push(
    `- Allowed candidates without legal review: ${summary.legalReview.allowedCandidatesWithoutLegalReview}`
  );
  lines.push("");

  lines.push("## Allowlist skips by source");
  lines.push("");
  if (summary.skippedBySourceAllowlist === 0) {
    lines.push("- None");
  } else {
    for (const [sourceKey, count] of Object.entries(summary.skippedBySourceKey).sort()) {
      lines.push(`- ${sourceKey}: ${count}`);
    }
  }
  lines.push("");

  lines.push("## Validation rejections");
  lines.push("");
  if (summary.rejectedByValidation === 0) {
    lines.push("- None");
  } else {
    for (const [reason, count] of Object.entries(summary.rejectionReasons).sort()) {
      lines.push(`- ${reason}: ${count}`);
    }
  }
  lines.push("");

  if (summary.failedInserts > 0) {
    lines.push("## Failed inserts");
    lines.push("");
    for (const failure of summary.failedInsertRecords) {
      lines.push(`- ${failure.sourceUrl}: ${failure.reason}`);
    }
    lines.push("");
  }

  lines.push("## Not in scope (this step)");
  lines.push("");
  lines.push("- No OpenAI calls");
  lines.push("- No Sanity writes");
  lines.push("- No publishing");
  lines.push("");

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv);
  const enabledSourceKeys = parseEnabledSourceKeys(process.env.INGESTION_ENABLED_SOURCE_KEYS);
  const candidates = readCandidates();

  const skippedBySourceKey: Record<string, number> = {};
  const rejectionReasons: Record<string, number> = {};
  const rejected: RejectedRecord[] = [];
  const eligible: NormalizedStoryCandidate[] = [];

  let legalReviewTrue = 0;
  let legalReviewFalse = 0;

  for (const candidate of candidates) {
    if (!isSourceEnabled(candidate.sourceKey, enabledSourceKeys)) {
      skippedBySourceKey[candidate.sourceKey] = (skippedBySourceKey[candidate.sourceKey] ?? 0) + 1;
      continue;
    }

    const validation = validateForInsert(candidate);
    if (!validation.valid) {
      rejected.push({
        sourceKey: candidate.sourceKey,
        sourceUrl: candidate.sourceUrl,
        reasons: validation.reasons,
      });
      for (const reason of validation.reasons) {
        rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      }
      continue;
    }

    eligible.push(candidate);
    const metadata = getSourceMetadata(candidate.sourceKey);
    if (metadata?.requiresLegalReview) {
      legalReviewTrue += 1;
    } else {
      legalReviewFalse += 1;
    }
  }

  let inserted = 0;
  let duplicates = 0;
  let failedInserts = 0;
  let failedInsertRecords: Array<{ sourceUrl: string; reason: string }> = [];

  if (mode === "dry-run") {
    if (hasSupabaseEnv() && eligible.length > 0) {
      const existing = await getExistingSourceUrls(eligible.map((c) => c.sourceUrl));
      duplicates = existing.size;
      inserted = eligible.length - duplicates;
    } else {
      inserted = eligible.length;
    }
  } else {
    const result = await insertStoryCandidates(eligible);
    inserted = result.insertedCount;
    duplicates = result.duplicateCount;
    failedInserts = result.failedCount;
    failedInsertRecords = result.failed;
  }

  const summary: InsertAuditSummary = {
    mode,
    generatedAt: new Date().toISOString(),
    inputPath: path.relative(process.cwd(), INPUT_PATH),
    reportsDirectory: path.relative(process.cwd(), OUTPUT_DIR),
    candidatesRead: candidates.length,
    candidatesValid: eligible.length,
    inserted,
    duplicates,
    skippedBySourceAllowlist: Object.values(skippedBySourceKey).reduce((sum, n) => sum + n, 0),
    skippedBySourceKey,
    rejectedByValidation: rejected.length,
    rejectionReasons,
    failedInserts,
    failedInsertRecords,
    legalReview: {
      allowedCandidatesMarkedForLegalReview: legalReviewTrue,
      allowedCandidatesWithoutLegalReview: legalReviewFalse,
    },
  };

  writeOutputs(summary, rejected);

  console.log("\nSupabase candidate insert audit complete");
  console.log(`Mode: ${summary.mode}`);
  console.log(`Candidates read: ${summary.candidatesRead}`);
  console.log(`Valid candidates: ${summary.candidatesValid}`);
  console.log(`Inserted: ${summary.inserted}`);
  console.log(`Duplicates: ${summary.duplicates}`);
  console.log(`Skipped by source allowlist: ${summary.skippedBySourceAllowlist}`);
  console.log(`Rejected by validation: ${summary.rejectedByValidation}`);
  console.log(`Failed inserts: ${summary.failedInserts}`);
  console.log(`Reports: ${summary.reportsDirectory}`);
}

main().catch((error) => {
  console.error("Candidate insert script failed:", error);
  process.exit(1);
});
