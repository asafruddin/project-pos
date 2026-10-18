import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") && !full.endsWith(".spec.ts")) out.push(full);
  }
  return out;
}

describe("Assistant isolation", () => {
  const files = walk(join(__dirname));

  it("never writes: no ledger, no DB mutations, no mutating services", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/insertStockMovement|stock-ledger/);
      expect(text).not.toMatch(/\.(insert|update|delete)\(/);
      expect(text).not.toMatch(/\.transaction\(/);
      expect(text).not.toMatch(/catalog\.service|promotions\.service|sales\.service/);
    }
  });

  it("keeps provider SDKs in llm-provider.ts only", () => {
    for (const file of files) {
      if (file.endsWith("llm-provider.ts")) continue;
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/@ai-sdk\/google|@openrouter\/ai-sdk-provider/);
    }
  });
});
