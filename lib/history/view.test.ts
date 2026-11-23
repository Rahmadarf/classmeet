import { describe, expect, it } from "vitest";
import { buildHistory, groupByDay, postNumber } from "./view";

const assets = { a: { symbol: "AP", name: "Apple" } };
const posts = { p3: { name: "Pos 3 · Estafet Balon", location: "Lapangan" } };

describe("postNumber", () => {
  it("mengambil nomor pos dua digit", () => {
    expect(postNumber("Pos 3 · Estafet Balon")).toBe("03");
    expect(postNumber("Pos 12 - X")).toBe("12");
    expect(postNumber("Lempar Cincin")).toBeNull();
  });
});

describe("buildHistory: analisa", () => {
  it("pembelian analisa masuk sebagai uang keluar (−harga) dan terurut bersama item lain", () => {
    const items = buildHistory(
      [],
      [{ id: 1, postId: "p3", amount: 300_000, note: null, createdAt: "2026-11-18T07:00:00Z" }],
      assets,
      posts,
      [],
      [
        {
          id: 9,
          newsTitle: "Harga minyak naik",
          price: 200_000,
          paragraphs: ["a", "b", "c", "d"],
          createdAt: "2026-11-18T08:00:00Z",
        },
      ],
    );
    expect(items.map((i) => i.kind)).toEqual(["analysis", "payout"]);
    expect(items[0]).toEqual({
      kind: "analysis",
      key: "a9",
      at: "2026-11-18T08:00:00Z",
      newsTitle: "Harga minyak naik",
      paragraphs: ["a", "b", "c", "d"],
      net: -200_000,
    });
  });
});

describe("buildHistory: dividen", () => {
  it("dividen masuk sebagai uang positif dan terurut bersama item lain", () => {
    const items = buildHistory([], [], assets, posts, [
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
    side: "buy" as const,
    price: 800_000,
    listPrice: 800_000,
    qty: 2,
    total: 1_600_000,
    createdAt: "2026-11-18T07:07:00Z",
    ...o,
  });

  it("beli: pengaruh saldo = −total pada harga tayang", () => {
    const [t] = buildHistory([trade({})], [], assets, posts);
    expect(t).toMatchObject({
      kind: "trade",
      side: "buy",
      price: 800_000,
      listPrice: 800_000,
      net: -1_600_000,
    });
  });

  it("jual: pengaruh saldo = +total pada harga jual (tayang dikurangi selisih)", () => {
    const [t] = buildHistory(
      [trade({ side: "sell", price: 94_300, listPrice: 96_300, qty: 3, total: 282_900 })],
      [],
      assets,
      posts,
    );
    expect(t).toMatchObject({ side: "sell", price: 94_300, listPrice: 96_300, qty: 3, net: 282_900 });
  });

  it("menggabungkan hadiah pos dan mengurutkan terbaru di atas", () => {
    const items = buildHistory(
      [trade({ id: 2, createdAt: "2026-11-18T07:07:00Z" })],
      [{ id: 9, postId: "p3", amount: 300_000, note: "juara", createdAt: "2026-11-18T07:05:00Z" }],
      assets,
      posts,
    );
    expect(items.map((i) => i.kind)).toEqual(["trade", "payout"]);
    expect(items[1]).toMatchObject({ postNumber: "03", net: 300_000, note: "juara" });
  });

  it("memakai nama umum untuk aset/pos tak dikenal", () => {
    const items = buildHistory(
      [trade({ id: 3, assetId: "zz" })],
      [{ id: 1, postId: "px", amount: 1, note: null, createdAt: "2026-11-18T01:00:00Z" }],
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
