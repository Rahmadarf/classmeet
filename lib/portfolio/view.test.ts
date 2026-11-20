import { describe, expect, it } from "vitest";
import { buildPortfolio } from "./view";

const assets = [
  { id: "a", symbol: "AP", name: "Apple", rankPrice: 824_000, price: 800_000 },
  { id: "b", symbol: "NB", name: "Nusabyte", rankPrice: null, price: 650_000 },
  { id: "c", symbol: "KS", name: "Kopi Senja", rankPrice: 175_000, price: 175_000 },
];

describe("buildPortfolio", () => {
  it("menilai qty × harga tayang (rank_price) dan memakai harga acuan bila belum ada", () => {
    const p = buildPortfolio(
      [
        { assetId: "a", qty: 3, costBasis: 2_405_400 },
        { assetId: "b", qty: 2, costBasis: 1_303_250 },
      ],
      assets,
    );
    expect(p.rows.map((r) => [r.symbol, r.value])).toEqual([
      ["AP", 2_472_000],
      ["NB", 1_300_000],
    ]);
    expect(p.totalValue).toBe(3_772_000);
    expect(p.totalCost).toBe(3_708_650);
    expect(p.totalPnl).toBe(63_350);
  });

  it("harga beli rata-rata per unit = cost_basis ÷ qty (dibulatkan) dan untung/rugi per aset", () => {
    const [ap] = buildPortfolio([{ assetId: "a", qty: 3, costBasis: 2_405_400 }], assets).rows;
    expect(ap.avgCost).toBe(801_800);
    expect(ap.pnl).toBe(2_472_000 - 2_405_400);
    expect(ap.pnlPct).toBeCloseTo(2.77, 1);
  });

  it("rugi bernilai negatif; qty 0 dan aset tak dikenal dibuang", () => {
    const p = buildPortfolio(
      [
        { assetId: "c", qty: 2, costBasis: 400_000 },
        { assetId: "a", qty: 0, costBasis: 0 },
        { assetId: "zzz", qty: 1, costBasis: 10 },
      ],
      assets,
    );
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].pnl).toBe(-50_000);
    expect(p.totalPnlPct).toBeCloseTo(-12.5, 5);
  });

  it("kosong → semuanya nol dan persen null", () => {
    expect(buildPortfolio([], assets)).toEqual({
      rows: [],
      totalValue: 0,
      totalCost: 0,
      totalPnl: 0,
      totalPnlPct: null,
    });
  });
});
