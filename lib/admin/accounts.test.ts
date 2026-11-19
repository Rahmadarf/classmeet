import { describe, expect, it } from "vitest";
import { makeShortCode, nextNumber, nextPostNumber, postDisplayName } from "./accounts";

describe("nextNumber", () => {
  it("nomor terbesar + 1, mengabaikan nama lain", () => {
    expect(nextNumber("tim", ["tim1", "tim7", "tim3", "admin", "timx"])).toBe(8);
    expect(nextNumber("guard", [])).toBe(1);
    expect(nextNumber("guard", ["guard6", "guard2"])).toBe(7);
  });
});

describe("nextPostNumber / postDisplayName", () => {
  it("dari nama pos bernomor", () => {
    expect(nextPostNumber(["Pos 1 · A", "Pos 6 · B", "Pos 3 · C", "Tanpa nomor"])).toBe(7);
    expect(nextPostNumber([])).toBe(1);
    expect(postDisplayName(7, "  Lompat Tali ")).toBe("Pos 7 · Lompat Tali");
  });
});

describe("makeShortCode", () => {
  it("6 karakter dari alfabet tanpa 0/O/1/I dan menghindari kode terpakai", () => {
    const code = makeShortCode(new Set());
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    let i = 0;
    const seq = (n: number) => (i++ < 6 ? 0 : 1) % n; // percobaan pertama "AAAAAA" (terpakai), berikutnya "BBBBBB"
    expect(makeShortCode(new Set(["AAAAAA"]), seq)).toBe("BBBBBB");
  });
});
