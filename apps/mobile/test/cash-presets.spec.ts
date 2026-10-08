import { cashPresets } from "@/utils/money";

describe("cashPresets", () => {
  it("offers four 10.000 steps, and fewer when the cap is reached", () => {
    expect(cashPresets(65_000)).toEqual([70_000, 80_000, 90_000, 100_000]);
    expect(cashPresets(75_000)).toEqual([80_000, 90_000, 100_000]);
    expect(cashPresets(120_000)).toEqual([120_000, 130_000, 140_000, 150_000]);
    expect(cashPresets(190_000)).toEqual([190_000, 200_000]);
  });

  it("caps shortcuts at 100.000 below that total and at 200.000 below 200.000", () => {
    expect(Math.max(...cashPresets(99_000))).toBe(100_000);
    expect(Math.max(...cashPresets(100_001))).toBeLessThanOrEqual(200_000);
    expect(Math.max(...cashPresets(199_000))).toBeLessThanOrEqual(200_000);
  });

  it("never suggests less than the amount due", () => {
    for (const total of [3_500, 8_500, 75_000, 120_000, 250_000]) {
      expect(cashPresets(total).every((amount) => amount >= total)).toBe(true);
    }
  });
});
