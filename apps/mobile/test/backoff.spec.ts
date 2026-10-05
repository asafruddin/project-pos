import { computeBackoffMs } from "@/infrastructure/sync/backoff";

describe("computeBackoffMs", () => {
  const mid = () => 0.5; // jitter factor 1.0

  it("grows exponentially from 1s", () => {
    expect([1, 2, 3, 4].map((n) => computeBackoffMs(n, mid))).toEqual([1000, 2000, 4000, 8000]);
  });

  it("caps at 5 minutes", () => {
    expect(computeBackoffMs(30, mid)).toBe(300_000);
    expect(computeBackoffMs(30, () => 1)).toBe(300_000);
  });

  it("applies ±20% jitter", () => {
    expect(computeBackoffMs(1, () => 0)).toBe(800);
    expect(computeBackoffMs(1, () => 1)).toBe(1200);
  });
});
