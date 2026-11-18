import { describe, expect, it } from "vitest";
import {
  estimateSweep,
  formatBps,
  formatCompactRupiah,
  lockPerLot,
  maxAffordableLots,
  stepDown,
  stepUp,
} from "./rules";

describe("stepUp / stepDown", () => {
  it("melompat satu fraksi menurut rentang", () => {
    expect(stepUp(120_000)).toBe(120_500);
    expect(stepUp(250_000)).toBe(251_000);
    expect(stepUp(800_000)).toBe(802_500);
    expect(stepDown(800_000)).toBe(797_500);
  });

  it("tetap kelipatan fraksi di batas rentang", () => {
    expect(stepUp(199_500)).toBe(200_000);
    expect(stepDown(200_000)).toBe(199_500);
    expect(stepUp(499_000)).toBe(500_000);
    expect(stepDown(500_000)).toBe(499_000); // bukan 497.500
    expect(stepDown(502_500)).toBe(500_000);
  });

  it("tidak turun di bawah satu fraksi", () => {
    expect(stepDown(500)).toBe(500);
  });
});

describe("kunci dan biaya", () => {
  it("lockPerLot = harga + biaya dibulatkan ke atas (contoh Figma: 802.500 → 804.507)", () => {
    expect(lockPerLot(802_500, 25)).toBe(804_507);
  });

  it("maxAffordableLots", () => {
    expect(maxAffordableLots(1_200_000, 802_500, 25)).toBe(1);
    expect(maxAffordableLots(0, 802_500, 25)).toBe(0);
    expect(maxAffordableLots(10_000_000, 0, 25)).toBe(0);
  });
});

describe("estimateSweep", () => {
  const offers = [
    { price: 802_500, lots: 4, freq: 2, mine: 0 },
    { price: 805_000, lots: 6, freq: 3, mine: 2 },
    { price: 807_500, lots: 2, freq: 1, mine: 0 },
  ];

  it("menyapu level terbaik berurutan dan melewati lot milik sendiri", () => {
    const e = estimateSweep(offers, 6, 5, 25);
    // 4 @ 802.500 + 2 @ 805.000 (6 − 2 milik sendiri = 4 tersedia, ambil 2)
    expect(e.filled).toBe(6);
    expect(e.gross).toBe(4 * 802_500 + 2 * 805_000);
    expect(e.fee).toBe(Math.ceil((802_500 * 4 * 25) / 10_000) + Math.ceil((805_000 * 2 * 25) / 10_000));
  });

  it("dibatasi jumlah level sapuan", () => {
    expect(estimateSweep(offers, 100, 2, 25).filled).toBe(4 + 4);
  });

  it("antrean kosong → tidak ada yang terisi", () => {
    expect(estimateSweep([], 3, 5, 25)).toEqual({ filled: 0, gross: 0, fee: 0 });
  });
});

describe("format", () => {
  it("formatCompactRupiah", () => {
    expect(formatCompactRupiah(38_300_000)).toBe("38,3 jt");
    expect(formatCompactRupiah(2_000_000)).toBe("2 jt");
    expect(formatCompactRupiah(1_250_000_000)).toBe("1,3 M");
    expect(formatCompactRupiah(0)).toBe("0");
  });

  it("formatBps", () => {
    expect(formatBps(25)).toBe("0,25 %");
    expect(formatBps(1500)).toBe("15,00 %");
  });
});
