import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUARD_PIN,
  DEFAULT_PIC_PIN,
  expectedPicPin,
  expectedPin,
  MAX_PIN_FAILURES,
  PIN_LOCK_MS,
  PinLimiter,
  pinMatches,
} from "./pin";

describe("expectedPin", () => {
  it("memakai 12345 bila tidak diatur atau tidak valid", () => {
    expect(expectedPin(undefined)).toBe(DEFAULT_GUARD_PIN);
    expect(expectedPin("")).toBe("12345");
    expect(expectedPin("abc")).toBe("12345");
    expect(expectedPin("123")).toBe("12345");
  });
  it("memakai nilai lingkungan yang valid", () => {
    expect(expectedPin(" 987654 ")).toBe("987654");
  });
});

describe("expectedPicPin", () => {
  it("memakai 54321 bila tidak diatur atau tidak valid, berbeda dari PIN penjaga", () => {
    expect(expectedPicPin(undefined)).toBe(DEFAULT_PIC_PIN);
    expect(expectedPicPin("")).toBe("54321");
    expect(expectedPicPin("abc")).toBe("54321");
    expect(expectedPicPin("123")).toBe("54321");
    expect(DEFAULT_PIC_PIN).not.toBe(DEFAULT_GUARD_PIN);
  });
  it("memakai nilai lingkungan yang valid", () => {
    expect(expectedPicPin(" 246810 ")).toBe("246810");
  });
});

describe("pinMatches", () => {
  it("cocok hanya bila sama persis", () => {
    expect(pinMatches("12345", "12345")).toBe(true);
    expect(pinMatches("12346", "12345")).toBe(false);
    expect(pinMatches("1234", "12345")).toBe(false);
    expect(pinMatches("123456", "12345")).toBe(false);
  });
});

describe("PinLimiter", () => {
  it("mengunci setelah 5 salah dan membuka lagi sesudah 60 dtk", () => {
    const l = new PinLimiter();
    for (let i = 0; i < MAX_PIN_FAILURES - 1; i++) {
      l.fail("g1", 0);
      expect(l.lockedFor("g1", 0)).toBe(0);
    }
    l.fail("g1", 0);
    expect(l.lockedFor("g1", 1_000)).toBe(59);
    expect(l.lockedFor("g1", PIN_LOCK_MS)).toBe(0);
  });
  it("berhasil mereset hitungan, dan akun lain tidak terpengaruh", () => {
    const l = new PinLimiter();
    for (let i = 0; i < 4; i++) l.fail("g1", 0);
    l.succeed("g1");
    l.fail("g1", 0);
    expect(l.lockedFor("g1", 0)).toBe(0);
    for (let i = 0; i < 5; i++) l.fail("g2", 0);
    expect(l.lockedFor("g2", 0)).toBeGreaterThan(0);
    expect(l.lockedFor("g1", 0)).toBe(0);
  });
});
