import { describe, expect, it } from "vitest";
import { buildHistory, groupByDay, postNumber } from "./view";

const ME = "me";
const assets = { a: { symbol: "AP", name: "Apple" } };
const posts = { p3: { name: "Pos 3 · Estafet Balon", location: "Lapangan" } };

describe("postNumber", () => {
  it("mengambil nomor pos dua digit", () => {
    expect(postNumber("Pos 3 · Estafet Balon")).toBe("03");
    expect(postNumber("Pos 12 - X")).toBe("12");
    expect(postNumber("Lempar Cincin")).toBeNull();
  });
});

describe("buildHistory: dividen", () => {
  it("dividen masuk sebagai uang positif dan terurut bersama item lain", () => {
    const items = buildHistory([], [], ME, assets, posts, [
      { id: 7, assetId: "a", qty: 3, perUnit: 36_170, amount: 108_510, createdAt: "2026-11-18T08:00:00Z" },
    ]);
    expect(items).toEqual([
      {
        kind: "dividend",
        key: "d7",
        at: "2026-11-18T08:00:00Z",
        symbol: "AP",
        name: "Apple",
        qty: 3,
        perUnit: 36_170,
        net: 108_510,
      },
    ]);
  });
});

describe("buildHistory", () => {
  const trade = (o: object) => ({
    id: 1,
    assetId: "a",
    price: 800_000,
    qty: 2,
    buyerId: ME,
    sellerId: null,
    buyerFee: 4_000,
    sellerFee: 0,
    createdAt: "2026-11-18T07:07:00Z",
    ...o,
  });

  it("beli: pengaruh saldo = −(nilai + biaya)", () => {
    const [t] = buildHistory([trade({})], [], ME, assets, posts);
    expect(t).toMatchObject({ kind: "trade", side: "buy", gross: 1_600_000, fee: 4_000, net: -1_604_000 });
  });

  it("jual: pengaruh saldo = nilai − biaya penjual", () => {
    const [t] = buildHistory(
      [trade({ buyerId: null, sellerId: ME, sellerFee: 722, price: 96_300, qty: 3 })],
      [],
      ME,
      assets,
      posts,
    );
    expect(t).toMatchObject({ side: "sell", gross: 288_900, fee: 722, net: 288_178 });
  });

  it("menggabungkan hadiah pos dan mengurutkan terbaru di atas", () => {
    const items = buildHistory(
      [trade({ id: 2, createdAt: "2026-11-18T07:07:00Z" })],
      [{ id: 9, postId: "p3", amount: 300_000, note: "juara", createdAt: "2026-11-18T07:05:00Z" }],
      ME,
      assets,
      posts,
    );
    expect(items.map((i) => i.kind)).toEqual(["trade", "payout"]);
    expect(items[1]).toMatchObject({ postNumber: "03", net: 300_000, note: "juara" });
  });

  it("membuang transaksi yang bukan milik tim ini dan memakai nama umum untuk aset/pos tak dikenal", () => {
    const items = buildHistory(
      [trade({ buyerId: "lain", sellerId: "lain2" }), trade({ id: 3, assetId: "zz" })],
      [{ id: 1, postId: "px", amount: 1, note: null, createdAt: "2026-11-18T01:00:00Z" }],
      ME,
      assets,
      posts,
    );
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.kind === "trade")).toMatchObject({ name: "Aset" });
    expect(items.find((i) => i.kind === "payout")).toMatchObject({ postName: "Pos", postNumber: null });
  });
});

describe("groupByDay", () => {
  it("memakai hari WIB: Hari ini, Kemarin, lalu tanggal penuh", () => {
    const now = Date.parse("2026-11-18T05:00:00Z"); // 18 Nov 12:00 WIB
    const mk = (at: string) => ({
      kind: "payout" as const,
      key: at,
      at,
      postName: "P",
      location: null,
      postNumber: null,
      note: null,
      net: 1,
    });
    const groups = groupByDay(
      [
        mk("2026-11-18T03:00:00Z"),
        mk("2026-11-17T20:00:00Z"),
        mk("2026-11-17T01:00:00Z"),
        mk("2026-11-15T01:00:00Z"),
      ],
      now,
    );
    // 17 Nov 20:00 UTC = 18 Nov 03:00 WIB (masih hari ini)
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["Hari ini · 18 Nov", 2],
      ["Kemarin · 17 Nov", 1],
      ["15 Nov 2026", 1],
    ]);
  });
});
