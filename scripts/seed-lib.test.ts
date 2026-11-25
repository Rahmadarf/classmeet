import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import poolFile from "./data/news-pool.json";
import {
  buildAssetRow,
  generateShortCode,
  stockForPrice,
  validateAssets,
  validateNews,
  type AssetSeed,
  type NewsSeed,
} from "./seed-lib";

const assets = assetsFile.assets as AssetSeed[];
const news = poolFile.news as unknown as NewsSeed[];

describe("data contoh aset", () => {
  it("berisi 30 aset = 6 sektor × 5", () => {
    expect(assets).toHaveLength(30);
    const bySector = new Map<string, number>();
    for (const a of assets) bySector.set(a.sector, (bySector.get(a.sector) ?? 0) + 1);
    expect(bySector.size).toBe(6);
    for (const n of bySector.values()) expect(n).toBe(5);
  });

  it("lolos validasi skema (simbol, harga, batas)", () => {
    expect(validateAssets(assets)).toEqual([]);
  });

  it("tingkatan stok dan batas harga sesuai doc 05", () => {
    expect(stockForPrice(110_000)).toBe(50);
    expect(stockForPrice(120_000)).toBe(50);
    expect(stockForPrice(130_000)).toBe(36);
    expect(stockForPrice(250_000)).toBe(36);
    expect(stockForPrice(400_000)).toBe(24);
    expect(stockForPrice(450_000)).toBe(16);
    expect(stockForPrice(600_000)).toBe(16);
    expect(stockForPrice(650_000)).toBe(10);
    expect(buildAssetRow({ sector: "x", symbol: "AP", name: "Apple", price: 800_000 })).toMatchObject({
      min_price: 240_000,
      max_price: 2_400_000,
      stock: 10,
    });
  });
});

describe("data contoh berita", () => {
  it("lolos aturan efek (10–15 aset, tidak nol, ≤ 1500 bps) dan semua simbol ada", () => {
    const symbols = new Set(assets.map((a) => a.symbol));
    expect(news).toHaveLength(650);
    expect(validateNews(news, symbols)).toEqual([]);
  });

  it("menolak berita yang melanggar aturan", () => {
    const symbols = new Set(["AP", "MI", "SA", "XI"]);
    const bad: NewsSeed[] = [
      { title: "a", body: "b", effects: [{ symbol: "AP", pct_bps: 500 }] },
      {
        title: "b",
        body: "b",
        effects: [
          { symbol: "AP", pct_bps: 0 },
          { symbol: "MI", pct_bps: 1600 },
          { symbol: "SA", pct_bps: 500 },
          { symbol: "ZZ", pct_bps: 500 },
        ],
      },
    ];
    const problems = validateNews(bad, symbols);
    expect(problems.some((p) => p.includes("jumlah aset"))).toBe(true);
    expect(problems.some((p) => p.includes("simbol ZZ"))).toBe(true);
    expect(problems.filter((p) => p.includes("tidak valid"))).toHaveLength(2);
  });
});

describe("short_code", () => {
  it("6 karakter, tanpa 0/O/1/I, unik", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = generateShortCode(taken);
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
    expect(taken.size).toBe(200);
  });
});
