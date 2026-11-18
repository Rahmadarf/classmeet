import { describe, expect, it } from "vitest";
import {
  assertMoney,
  dayKeyWib,
  formatDateWib,
  formatNumber,
  formatPercent,
  formatRupiah,
  formatSignedRupiah,
  formatTimeWib,
  groupThousands,
  orderFee,
  parseRupiah,
  percentChange,
  tickFor,
} from "./money";

describe("format rupiah", () => {
  it("memberi pemisah ribuan titik", () => {
    expect(formatRupiah(1_250_000)).toBe("Rp 1.250.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(999)).toBe("Rp 999");
    expect(formatRupiah(1_000)).toBe("Rp 1.000");
    expect(formatRupiah(123_456_789)).toBe("Rp 123.456.789");
  });

  it("menangani negatif dan kosong", () => {
    expect(formatRupiah(-75_000)).toBe("-Rp 75.000");
    expect(formatRupiah(null)).toBe("Rp –");
    expect(formatRupiah(undefined)).toBe("Rp –");
    expect(groupThousands(-1_000)).toBe("-1.000");
  });

  it("format angka tanpa awalan dan bertanda", () => {
    expect(formatNumber(800_000)).toBe("800.000");
    expect(formatSignedRupiah(300_000)).toBe("+Rp 300.000");
    expect(formatSignedRupiah(-300_000)).toBe("−Rp 300.000");
    expect(formatSignedRupiah(0)).toBe("Rp 0");
  });

  it("menolak bilangan pecahan dan di luar rentang aman", () => {
    expect(() => formatRupiah(1.5)).toThrow(RangeError);
    expect(() => formatRupiah(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
    expect(() => assertMoney(Number.NaN)).toThrow(RangeError);
    expect(assertMoney(42)).toBe(42);
  });
});

describe("parseRupiah", () => {
  it("mengambil digit saja", () => {
    expect(parseRupiah("Rp 1.250.000")).toBe(1_250_000);
    expect(parseRupiah("300000")).toBe(300_000);
    expect(parseRupiah("")).toBeNull();
    expect(parseRupiah("abc")).toBeNull();
    expect(parseRupiah("9".repeat(20))).toBeNull();
  });
});

describe("persen", () => {
  it("menghitung dan memformat dengan koma desimal", () => {
    expect(percentChange(103_000, 100_000)).toBeCloseTo(3, 5);
    expect(percentChange(95_000, 100_000)).toBeCloseTo(-5, 5);
    expect(percentChange(1, 0)).toBeNull();
    expect(formatPercent(3.04)).toBe("+3,0 %");
    expect(formatPercent(-5)).toBe("−5,0 %");
    expect(formatPercent(0)).toBe("0,0 %");
    expect(formatPercent(null)).toBe("–");
  });
});

describe("pratinjau order book", () => {
  it("fraksi harga mengikuti rentang", () => {
    expect(tickFor(150_000)).toBe(500);
    expect(tickFor(199_999)).toBe(500);
    expect(tickFor(200_000)).toBe(1_000);
    expect(tickFor(499_999)).toBe(1_000);
    expect(tickFor(500_000)).toBe(2_500);
  });

  it("biaya dibulatkan ke atas", () => {
    // 800.000 × 1 × 25 / 10000 = 2.000 tepat
    expect(orderFee(800_000, 1, 25)).toBe(2_000);
    // 150.500 × 1 × 25 / 10000 = 376,25 → 377
    expect(orderFee(150_500, 1, 25)).toBe(377);
    expect(orderFee(100_000, 3, 25)).toBe(750);
  });
});

describe("waktu WIB", () => {
  it("memakai Asia/Jakarta (UTC+7) dan 24 jam", () => {
    // 2026-11-17 07:07 UTC = 14:07 WIB
    expect(formatTimeWib("2026-11-17T07:07:00Z")).toBe("14:07");
    // 2026-11-17 17:30 UTC = 00:30 WIB hari berikutnya, jam tetap dua digit
    expect(formatTimeWib("2026-11-17T17:30:00Z")).toBe("00:30");
    expect(dayKeyWib("2026-11-17T17:30:00Z")).toBe("2026-11-18");
    expect(formatDateWib("2026-11-17T07:07:00Z")).toMatch(/^17 Nov\w* 2026$/);
  });
});
