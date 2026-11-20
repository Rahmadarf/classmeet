import { describe, expect, it } from "vitest";
import { buildTransactionsPage } from "./transactions";

const assets = [
  { id: "a", symbol: "AP", name: "Apple", stock: 2, initStock: 10, factorBps: 40 },
  { id: "b", symbol: "BC", name: "BCA", stock: 10, initStock: 10, factorBps: 0 },
  { id: "c", symbol: "DA", name: "Danone", stock: 30, initStock: 36, factorBps: -20 },
];
const tx = (o: object) => ({
  id: 1,
  teamId: "t1",
  assetId: "a",
  side: "buy",
  qty: 2,
  unitPrice: 500_000,
  total: 1_000_000,
  createdAt: "2026-11-20T01:00:00Z",
  ...o,
});

describe("buildTransactionsPage", () => {
  it("memetakan nama tim dan simbol, membuang sisi tak dikenal", () => {
    const page = buildTransactionsPage([tx({}), tx({ id: 2, side: "hold" })], [], { t1: "Elang" }, assets);
    expect(page.rows).toEqual([
      {
        id: 1,
        at: "2026-11-20T01:00:00Z",
        teamName: "Elang",
        symbol: "AP",
        side: "buy",
        qty: 2,
        price: 500_000,
        total: 1_000_000,
      },
    ]);
  });

  it("nama umum untuk tim dan aset tak dikenal", () => {
    const [r] = buildTransactionsPage([tx({ teamId: "x", assetId: "zz" })], [], {}, assets).rows;
    expect(r).toMatchObject({ teamName: "Tim", symbol: "—" });
  });

  it("ringkasan per aset dari agregat: nilai terbesar dulu, aset tanpa transaksi tetap tampil", () => {
    const page = buildTransactionsPage(
      [],
      [
        { assetId: "a", bought: 8, sold: 2, volume: 5_000_000, n: 5 },
        { assetId: "c", bought: 3, sold: 0, volume: 640_000, n: 2 },
      ],
      {},
      assets,
    );
    expect(page.flows.map((f) => f.symbol)).toEqual(["AP", "DA", "BC"]);
    expect(page.flows[0]).toMatchObject({
      bought: 8,
      sold: 2,
      volume: 5_000_000,
      count: 5,
      stock: 2,
      level: "mid",
    });
    expect(page.flows[2]).toMatchObject({ bought: 0, sold: 0, volume: 0, count: 0, level: "ok" });
    expect(page.totals).toEqual({ count: 7, volume: 5_640_000, bought: 11, sold: 2 });
  });

  it("label stok mengikuti batas yang diberikan", () => {
    const [ap] = buildTransactionsPage([], [], {}, assets, 90, 30).flows.filter((f) => f.symbol === "AP");
    expect(ap.level).toBe("low"); // 20 % < 30 %
    const [da] = buildTransactionsPage([], [], {}, assets, 90, 30).flows.filter((f) => f.symbol === "DA");
    expect(da.level).toBe("mid"); // 83 % < 90 %
  });
});
