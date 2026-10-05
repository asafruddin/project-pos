import { AppError } from "@/core/errors/app-error";
import type { HttpClient, HttpRequest } from "@/core/ports/http";
import { isJwtExpired } from "./jwt";

export type FetchHttpClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  /** Called on a 401 so the app can drop the session / ask for login. */
  onUnauthorized?: () => void;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
};

type ErrorBody = { code?: unknown; message?: unknown };

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: FetchHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(req: HttpRequest): Promise<T> {
    const headers: Record<string, string> = {};
    if (req.body !== undefined) headers["Content-Type"] = "application/json";

    if (!req.skipAuth) {
      const token = this.options.getToken();
      // An expired JWT can never succeed — don't spend a round trip on it.
      if (isJwtExpired(token, this.options.nowMs?.())) {
        this.options.onUnauthorized?.();
        throw new AppError("AUTH_SESSION_EXPIRED");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      req.timeoutMs ?? this.options.defaultTimeoutMs ?? 15_000,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${req.path}`, {
        method: req.method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new AppError("TIMEOUT");
      throw new AppError(
        "NETWORK",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      clearTimeout(timeout);
    }

    const body = await readJson(response);
    if (response.status === 401) {
      // Without a token (login) a 401 is just "wrong credentials": surface the server's message.
      if (!req.skipAuth) {
        this.options.onUnauthorized?.();
        throw new AppError("AUTH_UNAUTHORIZED", undefined, { status: 401 });
      }
      const err = (body ?? {}) as ErrorBody;
      throw new AppError("API", typeof err.message === "string" ? err.message : "HTTP 401", {
        status: 401,
        apiCode: typeof err.code === "string" ? err.code : undefined,
      });
    }
    if (!response.ok) {
      const err = (body ?? {}) as ErrorBody;
      throw new AppError(
        "API",
        typeof err.message === "string" ? err.message : `HTTP ${response.status}`,
        {
          status: response.status,
          apiCode: typeof err.code === "string" ? err.code : undefined,
        },
      );
    }
    return body as T;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
