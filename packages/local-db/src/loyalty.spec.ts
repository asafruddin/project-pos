import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("loyalty cache isolation", () => {
  it("does not invent points or import sale complete / Cloudinary", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "loyalty.ts"),
      "utf8",
    );
    assert.equal(
      /completeSale|insertStockMovement|cloudinary|shift_id/.test(src),
      false,
    );
  });
});
