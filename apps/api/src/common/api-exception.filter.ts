import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        "message" in body
      ) {
        response.status(status).json({
          code: String((body as { code: unknown }).code),
          message: this.formatMessage((body as { message: unknown }).message),
        });
        return;
      }
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" &&
              body !== null &&
              "message" in body
            ? this.formatMessage((body as { message: unknown }).message)
            : "Terjadi kesalahan.";
      response.status(status).json({
        code: `HTTP_${status}`,
        message,
      });
      return;
    }

    this.logger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server.",
    });
  }

  private formatMessage(message: unknown): string {
    if (typeof message === "string") return message;
    if (Array.isArray(message)) {
      return message.map((m) => String(m)).join("; ");
    }
    if (message == null) return "Terjadi kesalahan.";
    return String(message);
  }
}
