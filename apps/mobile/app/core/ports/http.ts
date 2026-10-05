export type HttpRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Skip the Authorization header (login, health). */
  skipAuth?: boolean;
  timeoutMs?: number;
};

/**
 * JSON API client. Resolves with the parsed body on 2xx and throws `AppError`
 * (NETWORK, TIMEOUT, AUTH_*, API) otherwise.
 */
export interface HttpClient {
  request<T>(req: HttpRequest): Promise<T>;
}
