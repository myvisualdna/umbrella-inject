/**
 * Shared helpers for reading latest-batch artifacts and emitting GitHub Actions outputs.
 */
import * as fs from "fs";
import * as path from "path";

export interface EmitOptions {
  allowMissing: boolean;
  stageLabel: string;
  artifactPath: string;
  requiredFields: string[];
  mapOutputs: (payload: Record<string, unknown>) => Record<string, string | number | boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAllowMissing(argv: string[]): boolean {
  return argv.includes("--allow-missing");
}

export function readLatestBatchArtifact(
  artifactPath: string,
  allowMissing: boolean
): Record<string, unknown> | null {
  if (!fs.existsSync(artifactPath)) {
    if (allowMissing) return null;
    throw new Error(`Missing artifact: ${path.relative(process.cwd(), artifactPath)}`);
  }

  const raw = fs.readFileSync(artifactPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON object in ${path.relative(process.cwd(), artifactPath)}`);
  }
  return parsed;
}

export function validateRequiredFields(
  payload: Record<string, unknown>,
  requiredFields: string[]
): void {
  for (const field of requiredFields) {
    if (!(field in payload)) {
      throw new Error(`Missing required field "${field}" in latest-batch artifact`);
    }
  }
}

export function appendGithubOutputs(outputs: Record<string, string | number | boolean>): void {
  const githubOutputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${String(value)}`);

  if (githubOutputPath) {
    fs.appendFileSync(githubOutputPath, `${lines.join("\n")}\n`, "utf-8");
    console.log(`Appended ${lines.length} output(s) to GITHUB_OUTPUT`);
  } else {
    console.log("GITHUB_OUTPUT not set; would emit:");
    for (const line of lines) {
      console.log(`  ${line}`);
    }
  }
}

export function emitGithubOutputsFromArtifact(options: EmitOptions): Record<string, string | number | boolean> {
  const payload = readLatestBatchArtifact(options.artifactPath, options.allowMissing);

  if (!payload) {
    console.log(`${options.stageLabel}: latest-batch artifact not found (--allow-missing)`);
    return {};
  }

  validateRequiredFields(payload, options.requiredFields);
  const outputs = options.mapOutputs(payload);

  console.log(`${options.stageLabel} latest-batch summary:`);
  console.log(JSON.stringify(outputs, null, 2));
  appendGithubOutputs(outputs);
  return outputs;
}
