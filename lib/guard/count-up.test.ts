import { describe, expect, it } from "vitest";
import { COUNT_UP_STEPS, countUpValue } from "./count-up";

describe("countUpValue", () => {
  it("mulai di saldo awal dan berakhir tepat di saldo baru", () => {
    expect(countUpValue(100, 50, 0)).toBe(100);
    expect(countUpValue(100, 50, COUNT_UP_STEPS)).toBe(150);
    expect(countUpValue(1_234_567, 999_999_999, COUNT_UP_STEPS)).toBe(1_234_567 + 999_999_999);
  });

  it("tidak pernah turun dan tidak melewati nilai akhir", () => {
    let prev = 100;
    for (let s = 0; s <= COUNT_UP_STEPS; s++) {
      const v = countUpValue(100, 50, s);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(150);
      prev = v;
    }
  });

  it("naik bertahap (bukan langsung ke angka akhir) untuk nominal kecil", () => {
    const mid = new Set(Array.from({ length: COUNT_UP_STEPS - 1 }, (_, i) => countUpValue(100, 50, i + 1)));
    expect(mid.size).toBeGreaterThan(5);
  });

  it("langkah di luar rentang dijepit", () => {
    expect(countUpValue(10, 5, -3)).toBe(10);
    expect(countUpValue(10, 5, 999)).toBe(15);
  });
});
