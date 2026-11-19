import { describe, expect, it } from "vitest";
import { countUpDurationMs } from "./count-up";

describe("countUpDurationMs", () => {
  it("nominal satu digit 1,6 dtk, dua digit sedikit lebih lama", () => {
    expect(countUpDurationMs(5)).toBe(1_600);
    expect(countUpDurationMs(50)).toBe(1_750);
  });

  it("naik menurut jumlah digit dan dibatasi 2,6 dtk", () => {
    expect(countUpDurationMs(5_000)).toBeGreaterThan(countUpDurationMs(50));
    expect(countUpDurationMs(999_999_999_999)).toBe(2_600);
  });

  it("tahan nilai aneh", () => {
    expect(countUpDurationMs(0)).toBe(1_600);
    expect(countUpDurationMs(-5)).toBe(1_600);
  });
});
