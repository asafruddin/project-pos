import { readAssistantConfig, isAssistantEnabled } from "./assistant-config";
import { assistantStreamErrorMessage } from "./assistant-errors";
import { RateLimiter } from "./rate-limiter";
import { buildDateReference, buildSystemPrompt } from "./system-prompt";

function env(values: Record<string, string>) {
  return { get: <T>(key: string) => values[key] as T | undefined };
}

describe("readAssistantConfig", () => {
  it("is disabled without an API key", () => {
    const config = readAssistantConfig(env({}));
    expect(config.provider).toBe("google");
    expect(isAssistantEnabled(config)).toBe(false);
  });

  it("defaults Gemini to a Flash model", () => {
    const config = readAssistantConfig(env({ GOOGLE_GENERATIVE_AI_API_KEY: "k" }));
    expect(config.model).toBe("gemini-flash-latest");
    expect(config.rateLimitPerMin).toBe(10);
    expect(isAssistantEnabled(config)).toBe(true);
  });

  it("requires an explicit model for OpenRouter", () => {
    const noModel = readAssistantConfig(env({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k" }));
    expect(isAssistantEnabled(noModel)).toBe(false);
    const withModel = readAssistantConfig(
      env({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k", AI_MODEL: "some/model:free" }),
    );
    expect(withModel).toMatchObject({ provider: "openrouter", model: "some/model:free" });
    expect(isAssistantEnabled(withModel)).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("allows N requests per window per key", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 60_000, () => now);
    expect(limiter.tryAcquire("a")).toBe(true);
    expect(limiter.tryAcquire("a")).toBe(true);
    expect(limiter.tryAcquire("a")).toBe(false);
    expect(limiter.tryAcquire("b")).toBe(true);
    now = 60_001;
    expect(limiter.tryAcquire("a")).toBe(true);
  });
});

describe("assistantStreamErrorMessage", () => {
  it("explains provider quota errors, including after retries", () => {
    expect(assistantStreamErrorMessage({ statusCode: 429 })).toMatch(/sibuk/);
    expect(assistantStreamErrorMessage({ lastError: { statusCode: 429 } })).toMatch(/sibuk/);
  });

  it("flags invalid keys", () => {
    expect(assistantStreamErrorMessage(new Error("API key not valid."))).toMatch(/Kunci API/);
  });

  it("falls back to a generic message", () => {
    expect(assistantStreamErrorMessage(new Error("boom"))).toMatch(/tidak dapat menjawab/);
  });
});

describe("buildDateReference", () => {
  it("resolves common phrases to UTC ranges (Saturday 2026-10-17)", () => {
    const text = buildDateReference("2026-10-17").join("\n");
    expect(text).toContain("2026-10-17 (Sabtu)");
    expect(text).toContain("kemarin: 2026-10-16");
    expect(text).toContain("minggu ini (Senin–hari ini): 2026-10-12 s/d 2026-10-17");
    expect(text).toContain("minggu lalu (Senin–Minggu): 2026-10-05 s/d 2026-10-11");
    expect(text).toContain("7 hari terakhir: 2026-10-11 s/d 2026-10-17");
    expect(text).toContain("30 hari terakhir: 2026-09-18 s/d 2026-10-17");
    expect(text).toContain("bulan ini: 2026-10-01 s/d 2026-10-17");
    expect(text).toContain("bulan lalu: 2026-09-01 s/d 2026-09-30");
  });

  it("handles Mondays, month starts, year boundaries and leap years", () => {
    const monday = buildDateReference("2026-10-12").join("\n");
    expect(monday).toContain("minggu ini (Senin–hari ini): 2026-10-12 s/d 2026-10-12");
    expect(monday).toContain("minggu lalu (Senin–Minggu): 2026-10-05 s/d 2026-10-11");

    const january = buildDateReference("2026-01-01").join("\n");
    expect(january).toContain("bulan lalu: 2025-12-01 s/d 2025-12-31");
    expect(january).toContain("minggu ini (Senin–hari ini): 2025-12-29 s/d 2026-01-01");

    expect(buildDateReference("2028-03-01").join("\n")).toContain(
      "bulan lalu: 2028-02-01 s/d 2028-02-29",
    );
  });

  it("returns nothing for an invalid date", () => {
    expect(buildDateReference("not-a-date")).toEqual([]);
  });
});

describe("buildSystemPrompt", () => {
  it("lists only the tools the account has", () => {
    const prompt = buildSystemPrompt({
      role: "cashier",
      toolNames: ["get_sales_summary", "get_product_ranking"],
      today: "2026-10-17",
    });
    expect(prompt).toContain("get_product_ranking:");
    expect(prompt).not.toContain("get_inventory_insights:");
    expect(prompt).not.toContain("propose_");
    expect(prompt).toContain("tanpa akses keuangan");
  });

  it("omits the no-financial warning for accounts with financial access", () => {
    const prompt = buildSystemPrompt({
      role: "owner",
      toolNames: ["get_sales_summary", "get_inventory_insights"],
      today: "2026-10-17",
    });
    expect(prompt).not.toContain("tanpa akses keuangan");
  });

  it("explains confirmation only when propose tools exist", () => {
    const withActions = buildSystemPrompt({
      role: "owner",
      toolNames: ["get_sales_summary", "search_products", "propose_update_price"],
      today: "2026-10-17",
    });
    expect(withActions).toContain("2026-10-17");
    expect(withActions).toContain("Konfirmasi");
    expect(withActions).toContain("propose_update_price:");
    expect(withActions).toContain("✅ Diterapkan oleh pengguna");

    const readOnly = buildSystemPrompt({
      role: "cashier",
      toolNames: ["get_sales_summary"],
      today: "2026-10-17",
    });
    expect(readOnly).not.toContain("Konfirmasi");
    expect(readOnly).toContain("tidak dapat mengubah data");
  });
});
