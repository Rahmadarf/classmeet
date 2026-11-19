import { describe, expect, it } from "vitest";
import { COUNT_UP_MS } from "./count-up";

describe("COUNT_UP_MS", () => {
  it("gerak saldo tidak lebih dari 0,5 detik", () => {
    expect(COUNT_UP_MS).toBeLessThanOrEqual(500);
    expect(COUNT_UP_MS).toBeGreaterThan(0);
  });
});
