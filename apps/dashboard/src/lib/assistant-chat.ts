import { DefaultChatTransport, type UIMessage } from "ai";
import { API_URL, authorizedFetch } from "@/lib/api-client";

/** Matches the API's HISTORY_LIMIT; older turns are not sent. */
const SEND_LIMIT = 20;
const STORAGE_KEY = "pos_apps_assistant_messages";

/**
 * Chat transport for `POST /assistant/chat`. Requests go through `authorizedFetch`
 * so the Bearer token and the 401 → login redirect behave like every other call.
 */
export function createAssistantTransport(): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport<UIMessage>({
    api: `${API_URL}/assistant/chat`,
    fetch: (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return authorizedFetch(url.slice(API_URL.length), init);
    },
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: { id, messages: messages.slice(-SEND_LIMIT) },
    }),
  });
}

/** `useChat` errors carry the raw response body; surface the API's `{ message }`. */
export function assistantErrorText(error: Error): string {
  if (error.message === "AUTH_UNAUTHORIZED" || error.message === "AUTH_SESSION_EXPIRED") {
    return "Sesi berakhir. Silakan masuk lagi.";
  }
  try {
    const body = JSON.parse(error.message) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    // Not JSON (network error or stream error text).
  }
  return error.message || "Asisten tidak dapat dihubungi.";
}

export function loadAssistantMessages(): UIMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveAssistantMessages(messages: UIMessage[]): void {
  try {
    if (messages.length === 0) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or blocked: history just won't survive a reload.
  }
}
