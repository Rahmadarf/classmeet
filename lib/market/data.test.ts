import { describe, expect, it } from "vitest";
import { mapOrderBook, mergeMarket } from "./data";

describe("mergeMarket", () => {
  const assets = [
    { id: "b", symbol: "BB", name: "Bata", sector: "Properti", price: 300_000, last_price: null },
    { id: "a", symbol: "AA", name: "Apel", sector: "Teknologi", price: 800_000, last_price: 800_000 },
  ];

  it("menggabungkan nama/sektor dengan statistik dan mengurutkan menurut simbol", () => {
    const out = mergeMarket(assets, [
      {
        asset_id: "a",
        symbol: "AA",
        ref_price: 780_000,
        last_price: 802_500,
        open_price: 780_000,
        high_price: 805_000,
        low_price: 777_500,
        lot: 48,
        val: 38_300_000,
        avg_price: 797_500,
        freq: 17,
      },
    ]);
    expect(out.map((a) => a.symbol)).toEqual(["AA", "BB"]);
    expect(out[0]).toMatchObject({ refPrice: 780_000, lastPrice: 802_500, high: 805_000, lot: 48, freq: 17 });
  });

  it("harga open hari ini dari get_day_open_prices; tanpa data memakai harga acuan", () => {
    const out = mergeMarket(assets, [], [{ asset_id: "a", open_price: 760_000 }]);
    expect(out.find((x) => x.symbol === "AA")).toMatchObject({ dayOpen: 760_000, refPrice: 800_000 });
    expect(out.find((x) => x.symbol === "BB")).toMatchObject({ dayOpen: 300_000, refPrice: 300_000 });
  });

  it("aset tanpa transaksi: harga acuan jadi harga terakhir, statistik harga null, volume 0", () => {
    const [, bata] = mergeMarket(assets, []);
    expect(bata).toMatchObject({
      lastPrice: 300_000,
      refPrice: 300_000,
      open: null,
      avg: null,
      lot: 0,
      val: 0,
    });
  });

  it("membuang aset dengan harga bukan bilangan bulat (data rusak)", () => {
    expect(
      mergeMarket([{ id: "x", symbol: "XX", name: "X", sector: "S", price: 1.5, last_price: null }], []),
    ).toEqual([]);
  });
});

describe("mapOrderBook", () => {
  it("bid tertinggi dan offer terendah di level 1", () => {
    const book = mapOrderBook([
      { side: "sell", price: 805_000, lots: 6, freq: 3, mine: 0 },
      { side: "buy", price: 795_000, lots: 8, freq: 3, mine: 1 },
      { side: "sell", price: 802_500, lots: 4, freq: 2, mine: 0 },
      { side: "buy", price: 797_500, lots: 5, freq: 2, mine: 0 },
    ]);
    expect(book.bids.map((l) => l.price)).toEqual([797_500, 795_000]);
    expect(book.offers.map((l) => l.price)).toEqual([802_500, 805_000]);
    expect(book.bids[1].mine).toBe(1);
  });

  it("kosong → dua sisi kosong", () => {
    expect(mapOrderBook([])).toEqual({ bids: [], offers: [] });
  });
});
