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

describe("Cloudinary isolation (AD-12)", () => {
  it("only cloudinary.adapter.ts imports the SDK", () => {
    const src = join(__dirname, "..");
    const hits: string[] = [];
    for (const file of walk(src)) {
      const text = readFileSync(file, "utf8");
      if (/from ["']cloudinary["']/.test(text) || /require\(["']cloudinary["']\)/.test(text)) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([join(__dirname, "cloudinary.adapter.ts")]);
  });
});
