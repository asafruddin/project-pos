import type { LanguageModel } from "ai";
import type { AssistantConfig } from "./assistant-config";

/**
 * Only file that knows provider SDKs. Switch models with AI_PROVIDER / AI_MODEL.
 * The SDKs are ESM-only and the API compiles to CommonJS, so they are loaded with
 * dynamic import(); a top-level require() crashes the whole API on Node < 22.12 (Vercel).
 */
export async function createLanguageModel(
  config: AssistantConfig,
): Promise<LanguageModel> {
  if (!config.apiKey || !config.model) {
    throw new Error("Assistant is not configured");
  }
  if (config.provider === "openrouter") {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    return createOpenRouter({ apiKey: config.apiKey })(config.model);
  }
  const { createGoogle } = await import("@ai-sdk/google");
  return createGoogle({ apiKey: config.apiKey })(config.model);
}
