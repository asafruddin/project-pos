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

describe("Stores isolation (AD-4 / AD-15)", () => {
  it("only transfer.service.ts writes the stock ledger", () => {
    const dir = join(__dirname);
    const hits: string[] = [];
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/from ["']cloudinary["']/);
      if (text.includes("insertStockMovement") || text.includes("stock-ledger")) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([join(__dirname, "transfer.service.ts")]);
  });
});
