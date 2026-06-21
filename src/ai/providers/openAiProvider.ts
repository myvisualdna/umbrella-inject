import OpenAI from "openai";
import { buildProcessedArticleSchema } from "../processedArticleSchema";
import { buildSystemPromptForCandidate, buildUserPrompt } from "../prompt";
import { getAllowedTagSlugsForAi } from "../tagCatalog";
import type {
  AiArticleProvider,
  AiProviderResult,
  ProcessedArticlePayload,
  WorkerStoryCandidate,
} from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/**
 * Real OpenAI provider. Only constructed when AI_PROVIDER=openai.
 * Requires OPENAI_API_KEY and never logs or persists the key.
 */
export class OpenAiProvider implements AiArticleProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when AI_PROVIDER=openai. Aborting before any processing."
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = getOpenAiModel();
  }

  async generateArticleDraft(
    candidate: WorkerStoryCandidate
  ): Promise<AiProviderResult> {
    const startedAt = Date.now();
    const allowedTagSlugs = getAllowedTagSlugsForAi();
    const schema = buildProcessedArticleSchema({ allowedTagSlugs });

    const systemPrompt = buildSystemPromptForCandidate(candidate, allowedTagSlugs);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(candidate) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "processed_article",
          strict: true,
          schema,
        },
      },
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    let payload: ProcessedArticlePayload;
    try {
      payload = JSON.parse(content) as ProcessedArticlePayload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse OpenAI JSON response: ${message}`);
    }

    return {
      payload,
      meta: {
        provider: "openai",
        model: response.model ?? this.model,
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
        raw: {
          id: response.id,
          model: response.model,
          finishReason: choice?.finish_reason ?? null,
          usage: response.usage ?? null,
        },
      },
    };
  }
}
