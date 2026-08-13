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

describe("Reports isolation (AD-15)", () => {
  it("does not import Cloudinary or write the stock ledger", () => {
    for (const file of walk(join(__dirname))) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/from ["']cloudinary["']/);
      expect(text).not.toMatch(/insertStockMovement|stock-ledger/);
    }
  });
});
