export type AppErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "AUTH_UNAUTHORIZED"
  | "AUTH_SESSION_EXPIRED"
  | "API"
  | "VALIDATION"
  | "NO_OPEN_SHIFT"
  | "PRINTER"
  | "PDF";

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** HTTP status when the error came from an API response. */
  readonly status?: number;
  /** Machine code from the API error body (`{ code, message }`). */
  readonly apiCode?: string;

  constructor(
    code: AppErrorCode,
    message?: string,
    extra?: { status?: number; apiCode?: string },
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = extra?.status;
    this.apiCode = extra?.apiCode;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isAuthError(error: unknown): boolean {
  return (
    isAppError(error) &&
    (error.code === "AUTH_UNAUTHORIZED" || error.code === "AUTH_SESSION_EXPIRED")
  );
}

/**
 * Worth retrying later without user action: no connection, timeout, server 5xx,
 * rate limiting. Everything else (4xx validation, business rule) is permanent.
 */
export function isTransientError(error: unknown): boolean {
  if (!isAppError(error)) return true;
  if (error.code === "NETWORK" || error.code === "TIMEOUT") return true;
  if (error.code === "API") {
    const status = error.status ?? 0;
    return status >= 500 || status === 408 || status === 429;
  }
  return false;
}
