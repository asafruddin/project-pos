import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { AssistantStatusResponse } from "@pos-apps/types";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { AssistantService } from "./assistant.service";

@Controller("assistant")
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get("status")
  status(): AssistantStatusResponse {
    return this.assistant.status();
  }

  /** Streams an AI SDK UI message stream (SSE) consumed by Dashboard `useChat`. */
  @Post("chat")
  async chat(
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const stream = await this.assistant.chat(body, user, abort.signal);
    const { pipeUIMessageStreamToResponse } = await import("ai");
    await pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
