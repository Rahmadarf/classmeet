import { describe, expect, it } from "vitest";
import {
  buyTotal,
  formatBps,
  formatCompactRupiah,
  holdCap,
  maxBuyQty,
  sellPriceOf,
  sellTotal,
  shopPriceAt,
  stockLevel,
  type PriceModel,
} from "./rules";

describe("stockLevel", () => {
  it("habis, langka (< 20 %), menipis (< 50 %), aman", () => {
    expect(stockLevel(0, 10, 50, 20)).toBe("out");
    expect(stockLevel(1, 10, 50, 20)).toBe("low"); // 10 %
    expect(stockLevel(2, 10, 50, 20)).toBe("mid"); // tepat 20 % bukan langka
    expect(stockLevel(4, 10, 50, 20)).toBe("mid");
    expect(stockLevel(5, 10, 50, 20)).toBe("ok"); // tepat 50 % aman
    expect(stockLevel(10, 10, 50, 20)).toBe("ok");
  });

  it("stok awal 0 dianggap aman bila ada sisa", () => {
    expect(stockLevel(3, 0, 50, 20)).toBe("ok");
  });
});

describe("holdCap", () => {
  it("30 % stok awal, minimal 1 unit (sama dengan buy_asset)", () => {
    expect(holdCap(10, 30)).toBe(3);
    expect(holdCap(36, 30)).toBe(10);
    expect(holdCap(5, 30)).toBe(1);
    expect(holdCap(1, 30)).toBe(1);
  });
});

describe("sellPriceOf", () => {
  it("harga tayang dikurangi selisih, dibulatkan ke bawah ke kelipatan 100", () => {
    expect(sellPriceOf(156_400, 200)).toBe(153_200); // 153.272 → 153.200
    expect(sellPriceOf(737_800, 200)).toBe(723_000); // 723.044 → 723.000
    expect(sellPriceOf(110_000, 200)).toBe(107_800);
  });

  it("selisih 0 mengembalikan harga yang sama; tidak di bawah satu kelipatan", () => {
    expect(sellPriceOf(110_000, 0)).toBe(110_000);
    expect(sellPriceOf(50, 200)).toBe(100);
  });
});

describe("maxBuyQty", () => {
  it("dibatasi saldo, stok, dan sisa batas pegang (yang terkecil)", () => {
    expect(maxBuyQty({ cash: 1_000_000, price: 100_000, stock: 50, held: 0, cap: 10 })).toBe(10);
    expect(maxBuyQty({ cash: 350_000, price: 100_000, stock: 50, held: 0, cap: 10 })).toBe(3);
    expect(maxBuyQty({ cash: 1_000_000, price: 100_000, stock: 2, held: 0, cap: 10 })).toBe(2);
    expect(maxBuyQty({ cash: 1_000_000, price: 100_000, stock: 50, held: 8, cap: 10 })).toBe(2);
  });

  it("tidak pernah negatif; saldo belum termuat tidak membatasi", () => {
    expect(maxBuyQty({ cash: 0, price: 100_000, stock: 5, held: 0, cap: 3 })).toBe(0);
    expect(maxBuyQty({ cash: 1_000_000, price: 100_000, stock: 5, held: 4, cap: 3 })).toBe(0);
    expect(maxBuyQty({ cash: null, price: 100_000, stock: 5, held: 0, cap: 3 })).toBe(3);
  });
});

const model = (o: Partial<PriceModel> = {}): PriceModel => ({
  refPrice: 400_000,
  minPrice: 120_000,
  maxPrice: 1_200_000,
  factorBps: 0,
  step: 100,
  pressureBps: 20,
  capBps: 1500,
  spreadBps: 200,
  ...o,
});

describe("total beli/jual dengan tekanan di dalam transaksi (cermin trading-impact.sql)", () => {
  it("satu unit = harga tayang / harga jual yang tampil", () => {
    expect(buyTotal(model(), 1)).toBe(400_000);
    expect(sellTotal(model(), 1)).toBe(sellPriceOf(400_000, 200));
  });

  it("beli: tiap unit naik satu langkah tekanan (0,2 %)", () => {
    // 400.000, 400.800, 401.600 (dibulatkan ke kelipatan 100)
    expect(buyTotal(model(), 3)).toBe(400_000 + shopPriceAt(model(), 20) + shopPriceAt(model(), 40));
    expect(buyTotal(model(), 3)).toBeGreaterThan(3 * 400_000);
  });

  it("jual: tiap unit turun satu langkah", () => {
    expect(sellTotal(model(), 3)).toBeLessThan(3 * sellPriceOf(400_000, 200));
  });

  it("bolak-balik beli lalu jual selalu rugi, berapa pun jumlahnya (tidak ada arbitrase)", () => {
    for (const n of [1, 2, 5, 10, 20, 35, 70]) {
      const paid = buyTotal(model(), n);
      const back = sellTotal(model({ factorBps: Math.min(1500, n * 20) }), n);
      expect(paid - back, `n=${n}`).toBeGreaterThan(0);
      expect((paid - back) / paid, `n=${n}`).toBeGreaterThan(0.015);
    }
  });

  it("tekanan dibatasi batas tekanan dan harga dibatasi min/maks", () => {
    expect(buyTotal(model({ factorBps: 1480 }), 3)).toBe(
      shopPriceAt(model(), 1480) + 2 * shopPriceAt(model(), 1500),
    );
    expect(shopPriceAt(model({ refPrice: 100_000 }), 0)).toBe(120_000);
  });

  it("maxBuyQty memakai biaya sebenarnya bila `total` diberikan", () => {
    const m = model();
    const cash = buyTotal(m, 4) + 10; // cukup untuk 4 unit, kurang untuk 5
    expect(
      maxBuyQty({ cash, price: 400_000, stock: 50, held: 0, cap: 20, total: (n) => buyTotal(m, n) }),
    ).toBe(4);
  });
});

describe("format", () => {
  it("formatCompactRupiah", () => {
    expect(formatCompactRupiah(38_300_000)).toBe("38,3 jt");
    expect(formatCompactRupiah(2_000_000)).toBe("2 jt");
    expect(formatCompactRupiah(1_250_000_000)).toBe("1,3 M");
    expect(formatCompactRupiah(0)).toBe("0");
  });

  it("formatBps tanpa nol di belakang koma", () => {
    expect(formatBps(200)).toBe("2 %");
    expect(formatBps(25)).toBe("0,25 %");
    expect(formatBps(20)).toBe("0,2 %");
    expect(formatBps(1500)).toBe("15 %");
    expect(formatBps(0)).toBe("0 %");
  });
});
