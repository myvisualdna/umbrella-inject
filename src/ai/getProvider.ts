import { MockAiProvider } from "./providers/mockAiProvider";
import { OpenAiProvider } from "./providers/openAiProvider";
import type { AiArticleProvider, AiProviderName } from "./types";

export function parseProviderName(raw?: string): AiProviderName {
  const value = (raw ?? "mock").trim().toLowerCase();
  if (value === "openai") return "openai";
  if (value === "mock" || value === "") return "mock";
  throw new Error(`Unknown AI_PROVIDER: ${raw}. Use "mock" or "openai".`);
}

/**
 * Returns the configured AI provider. Defaults to the mock provider.
 * The OpenAI provider constructor asserts OPENAI_API_KEY before returning,
 * so callers fail fast before any candidate is claimed.
 */
export function getProvider(raw?: string): AiArticleProvider {
  const name = parseProviderName(raw ?? process.env.AI_PROVIDER);
  if (name === "openai") {
    return new OpenAiProvider();
  }
  return new MockAiProvider();
}
