import { createGoogle } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { AssistantConfig } from "./assistant-config";

/** Only file that knows provider SDKs. Switch models with AI_PROVIDER / AI_MODEL. */
export function createLanguageModel(config: AssistantConfig): LanguageModel {
  if (!config.apiKey || !config.model) {
    throw new Error("Assistant is not configured");
  }
  if (config.provider === "openrouter") {
    return createOpenRouter({ apiKey: config.apiKey })(config.model);
  }
  return createGoogle({ apiKey: config.apiKey })(config.model);
}
