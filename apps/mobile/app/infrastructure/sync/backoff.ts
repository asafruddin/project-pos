const BASE_MS = 1_000;
const CAP_MS = 5 * 60_000;

/**
 * Exponential backoff with ±20% jitter: ~1s, 2s, 4s, ... capped at 5 min.
 * `attempt` is the number of failures so far (>= 1).
 */
export function computeBackoffMs(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(CAP_MS, BASE_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = 0.8 + random() * 0.4;
  return Math.min(CAP_MS, Math.round(exp * jitter));
}
