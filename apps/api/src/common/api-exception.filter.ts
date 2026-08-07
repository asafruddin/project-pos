import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
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
          message: String((body as { message: unknown }).message),
        });
        return;
      }
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" &&
              body !== null &&
              "message" in body
            ? String((body as { message: unknown }).message)
            : "Terjadi kesalahan.";
      response.status(status).json({
        code: `HTTP_${status}`,
        message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server.",
    });
  }
}
