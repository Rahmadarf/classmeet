import { describe, expect, it } from "vitest";
import { lastTrades, movers, parseIndex, topFive } from "./view";

describe("topFive", () => {
  const row = (rank: number, name: string, net: number) => ({
    rank,
    team_id: name,
    team_name: name,
    cash: 1,
    holdings_value: net - 1,
    net_worth: net,
  });

  it("memotong lima teratas menurut peringkat dan nama", () => {
    const rows = [
      row(3, "C", 30),
      row(1, "A", 50),
      row(2, "B", 40),
      row(4, "D", 20),
      row(5, "E", 10),
      row(6, "F", 5),
    ];
    expect(topFive(rows).map((r) => r.name)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("seri berbagi peringkat dan diurutkan menurut nama; baris tak lengkap dibuang", () => {
    const rows = [
      row(1, "B", 10),
      row(1, "A", 10),
      { rank: null, team_id: "x", team_name: "X", cash: 0, holdings_value: 0, net_worth: 0 },
    ];
    expect(topFive(rows).map((r) => r.name)).toEqual(["A", "B"]);
  });
});

describe("parseIndex", () => {
  it("memisahkan IKC dan sektor, persen terhadap basis 1.000", () => {
    const s = parseIndex([
      { scope: "IKC", value: 1052.2 },
      { scope: "sektor:Teknologi", value: 1074.8 },
      { scope: "sektor:Konstruksi", value: 998.4 },
    ]);
    expect(s.ikc).toBe(1052.2);
    expect(s.sectors.map((x) => x.name)).toEqual(["Konstruksi", "Teknologi"]);
    expect(s.sectors[0].pct).toBeCloseTo(-0.16, 5);
    expect(s.sectors[1].pct).toBeCloseTo(7.48, 5);
  });

  it("tanpa IKC → null", () => {
    expect(parseIndex([]).ikc).toBeNull();
  });
});

describe("movers", () => {
  const a = (symbol: string, ref: number, last: number) => ({
    symbol,
    name: symbol,
    refPrice: ref,
    lastPrice: last,
  });
  it("terbaik dari yang naik, terlemah dari yang turun; yang tidak bergerak tidak ikut", () => {
    const { best, worst } = movers(
      [a("A", 100, 107), a("B", 100, 105), a("C", 100, 100), a("D", 100, 96), a("E", 100, 99)],
      2,
    );
    expect(best.map((m) => m.symbol)).toEqual(["A", "B"]);
    expect(worst.map((m) => m.symbol)).toEqual(["D", "E"]);
  });
  it("tak ada pergerakan → kedua daftar kosong", () => {
    expect(movers([a("A", 100, 100)])).toEqual({ best: [], worst: [] });
  });
});

describe("lastTrades", () => {
  it("terbaru dulu dan hanya aset yang pernah bertransaksi", () => {
    const out = lastTrades(
      [
        { symbol: "A", lastPrice: 1, lastTradeAt: "2026-11-18T01:00:00Z" },
        { symbol: "B", lastPrice: 2, lastTradeAt: null },
        { symbol: "C", lastPrice: 3, lastTradeAt: "2026-11-18T02:00:00Z" },
      ],
      3,
    );
    expect(out.map((t) => t.symbol)).toEqual(["C", "A"]);
  });
});
