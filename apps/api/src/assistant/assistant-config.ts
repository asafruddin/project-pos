import type { ConfigService } from "@nestjs/config";

export type AssistantProvider = "google" | "openrouter";

export type AssistantConfig = {
  provider: AssistantProvider;
  model: string | null;
  apiKey: string | null;
  rateLimitPerMin: number;
};

/** OpenRouter's free catalogue changes often, so it has no default: set AI_MODEL. */
const DEFAULT_MODEL: Record<AssistantProvider, string | null> = {
  google: "gemini-flash-latest",
  openrouter: null,
};

export function readAssistantConfig(
  config: Pick<ConfigService, "get">,
): AssistantConfig {
  const raw = config.get<string>("AI_PROVIDER")?.trim().toLowerCase();
  const provider: AssistantProvider = raw === "openrouter" ? "openrouter" : "google";
  const apiKey =
    (provider === "google"
      ? config.get<string>("GOOGLE_GENERATIVE_AI_API_KEY")
      : config.get<string>("OPENROUTER_API_KEY")
    )?.trim() || null;
  const model = config.get<string>("AI_MODEL")?.trim() || DEFAULT_MODEL[provider];
  const limit = Number.parseInt(config.get<string>("AI_RATE_LIMIT_PER_MIN") ?? "", 10);
  return {
    provider,
    model,
    apiKey,
    rateLimitPerMin: Number.isInteger(limit) && limit > 0 ? limit : 10,
  };
}

export function isAssistantEnabled(config: AssistantConfig): boolean {
  return Boolean(config.apiKey && config.model);
}
