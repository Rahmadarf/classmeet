import { describe, expect, it } from "vitest";
import { mergeMarket } from "./data";

describe("mergeMarket", () => {
  const assets = [
    { id: "b", symbol: "BB", name: "Bata", sector: "Properti", price: 300_000, last_price: 300_000 },
    { id: "a", symbol: "AA", name: "Apel", sector: "Teknologi", price: 800_000, last_price: 800_000 },
  ];

  it("menggabungkan nama/sektor dengan harga, stok, dan statistik; urut menurut simbol", () => {
    const out = mergeMarket(assets, [
      {
        asset_id: "a",
        symbol: "AA",
        ref_price: 780_000,
        last_price: 790_400,
        sell_price: 774_500,
        stock: 7,
        init_stock: 10,
        price_factor_bps: 130,
        open_price: 780_000,
        high_price: 792_000,
        low_price: 780_000,
        lot: 5,
        val: 3_900_000,
        avg_price: 783_000,
        freq: 3,
      },
    ]);
    expect(out.map((a) => a.symbol)).toEqual(["AA", "BB"]);
    expect(out[0]).toMatchObject({
      refPrice: 780_000,
      lastPrice: 790_400,
      sellPrice: 774_500,
      stock: 7,
      initStock: 10,
      factorBps: 130,
      high: 792_000,
      lot: 5,
      freq: 3,
    });
  });

  it("harga open hari ini dari get_day_open_prices; tanpa data memakai harga acuan", () => {
    const out = mergeMarket(assets, [], [{ asset_id: "a", open_price: 760_000 }]);
    expect(out.find((x) => x.symbol === "AA")).toMatchObject({ dayOpen: 760_000, refPrice: 800_000 });
    expect(out.find((x) => x.symbol === "BB")).toMatchObject({ dayOpen: 300_000, refPrice: 300_000 });
  });

  it("tanpa ringkasan: harga tayang dari aset, harga jual dihitung dari selisih, stok dari aset", () => {
    const [, bata] = mergeMarket(
      [{ ...assets[0], stock: 24, init_stock: 24, price_factor_bps: 0 }, assets[1]],
      [],
      [],
      200,
    );
    expect(bata).toMatchObject({
      lastPrice: 300_000,
      refPrice: 300_000,
      sellPrice: 294_000,
      stock: 24,
      initStock: 24,
      factorBps: 0,
      open: null,
      avg: null,
      lot: 0,
      val: 0,
    });
  });

  it("membuang aset dengan harga bukan bilangan bulat (data rusak)", () => {
    expect(
      mergeMarket([{ id: "x", symbol: "XX", name: "X", sector: "S", price: 1.5, last_price: 1.5 }], []),
    ).toEqual([]);
  });
});
