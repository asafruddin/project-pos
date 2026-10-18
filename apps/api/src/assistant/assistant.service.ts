import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AssistantStatusResponse } from "@pos-apps/types";
import {
  convertToModelMessages,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { CustomersService } from "../customers/customers.service";
import { InventoryService } from "../inventory/inventory.service";
import { ReportsService } from "../reports/reports.service";
import {
  isAssistantEnabled,
  readAssistantConfig,
  type AssistantConfig,
} from "./assistant-config";
import { assistantStreamErrorMessage } from "./assistant-errors";
import { createLanguageModel } from "./llm-provider";
import { ProductLookup } from "./product-lookup";
import { RateLimiter } from "./rate-limiter";
import { buildSystemPrompt } from "./system-prompt";
import { toolsFor, type AssistantDeps, type AssistantViewer } from "./tools";

/** Older turns are dropped to bound tokens on free-tier models. */
const HISTORY_LIMIT = 20;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly config: AssistantConfig;
  private readonly limiter: RateLimiter;
  private readonly deps: AssistantDeps;

  constructor(
    config: ConfigService,
    reports: ReportsService,
    inventory: InventoryService,
    customers: CustomersService,
    products: ProductLookup,
  ) {
    this.config = readAssistantConfig(config);
    this.limiter = new RateLimiter(this.config.rateLimitPerMin);
    this.deps = { reports, inventory, customers, products };
  }

  status(): AssistantStatusResponse {
    const enabled = isAssistantEnabled(this.config);
    return {
      enabled,
      provider: enabled ? this.config.provider : null,
      model: enabled ? this.config.model : null,
    };
  }

  async chat(
    body: unknown,
    viewer: AssistantViewer,
    abortSignal: AbortSignal,
  ): Promise<ReadableStream<UIMessageChunk>> {
    if (!isAssistantEnabled(this.config)) {
      throw new ServiceUnavailableException({
        code: "AI_DISABLED",
        message: "Asisten belum dikonfigurasi.",
      });
    }
    if (!this.limiter.tryAcquire(viewer.userId)) {
      throw new HttpException(
        {
          code: "AI_RATE_LIMITED",
          message: "Terlalu banyak pertanyaan. Tunggu sebentar lalu coba lagi.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const raw =
      typeof body === "object" && body !== null && "messages" in body
        ? (body as { messages: unknown }).messages
        : undefined;
    const validated = await safeValidateUIMessages<UIMessage>({ messages: raw });
    if (!validated.success) {
      throw new BadRequestException({
        code: "AI_INVALID_MESSAGES",
        message: "Format percakapan tidak valid.",
      });
    }

    const tools = toolsFor(viewer, this.deps) as unknown as ToolSet;
    const result = streamText({
      model: createLanguageModel(this.config),
      instructions: buildSystemPrompt({
        role: viewer.role,
        toolNames: Object.keys(tools),
        today: new Date().toISOString().slice(0, 10),
      }),
      messages: await convertToModelMessages(validated.data.slice(-HISTORY_LIMIT), {
        ignoreIncompleteToolCalls: true,
      }),
      tools,
      stopWhen: isStepCount(6),
      maxOutputTokens: 2048,
      maxRetries: 1,
      abortSignal,
      onError: ({ error }) => {
        this.logger.warn(`Assistant stream failed: ${String(error)}`);
      },
    });

    return toUIMessageStream({
      stream: result.stream,
      tools,
      onError: assistantStreamErrorMessage,
    });
  }
}
