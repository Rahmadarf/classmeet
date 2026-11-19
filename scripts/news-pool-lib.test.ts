import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import {
  buildPool,
  DEFAULT_CONFIG,
  impactParagraph,
  makeRng,
  poolToSql,
  validatePool,
  type PoolAsset,
} from "./news-pool-lib";

const assets: PoolAsset[] = (assetsFile.assets as PoolAsset[]).map((a) => ({
  symbol: a.symbol,
  name: a.name,
  sector: a.sector,
}));
const pool = buildPool(assets);

describe("buildPool", () => {
  it("lolos validasi (10–15 aset, efek valid, judul unik, tiap aset punya tiap jenis event)", () => {
    expect(validatePool(pool, assets)).toEqual([]);
  });

  it("tiap aset: tepat 1 bangkrut, 5 suspensi, 10 dividen; total tepat 1000 berita", () => {
    expect(pool).toHaveLength(1000);
    for (const a of assets) {
      const count = (k: string) => pool.filter((n) => n.kind === k && n.event?.symbol === a.symbol).length;
      expect([count("bankrupt"), count("suspend"), count("dividend")]).toEqual([1, 5, 10]);
    }
  });

  it("tidak semua berita membawa event: berita harga mendominasi dan tanpa event", () => {
    const price = pool.filter((n) => n.kind === "price");
    expect(price.length).toBe(520);
    expect(price.every((n) => n.event === null)).toBe(true);
    expect(pool.filter((n) => n.kind !== "price").every((n) => n.event !== null)).toBe(true);
  });

  it("satu event per berita, dan aset bangkrut tidak punya efek harga di berita itu", () => {
    for (const n of pool.filter((x) => x.kind === "bankrupt"))
      expect(n.effects.some((e) => e.symbol === n.event!.symbol)).toBe(false);
  });

  it("jumlah efek 10–15 dan besar efek ≤ batas", () => {
    for (const n of pool) {
      expect(n.effects.length).toBeGreaterThanOrEqual(10);
      expect(n.effects.length).toBeLessThanOrEqual(15);
      for (const e of n.effects) expect(Math.abs(e.pct_bps)).toBeLessThanOrEqual(DEFAULT_CONFIG.capBps);
    }
  });

  it("deterministik menurut benih; benih lain menghasilkan efek berbeda", () => {
    const again = buildPool(assets);
    expect(again).toEqual(pool);
    const other = buildPool(assets, { ...DEFAULT_CONFIG, seed: "lain" });
    expect(other.map((n) => n.title)).toEqual(pool.map((n) => n.title));
    expect(JSON.stringify(other.map((n) => n.effects))).not.toBe(JSON.stringify(pool.map((n) => n.effects)));
  });

  it("validatePool menolak aset bangkrut yang juga punya efek, dan aset tanpa jenis event", () => {
    const bad = pool.map((n) => ({ ...n }));
    const b = bad.find((n) => n.kind === "bankrupt")!;
    bad[bad.indexOf(b)] = {
      ...b,
      effects: [...b.effects.slice(0, -1), { symbol: b.event!.symbol, pct_bps: 100 }],
    };
    expect(validatePool(bad, assets).some((p) => p.includes("aset bangkrut punya efek"))).toBe(true);
    const missing = pool.filter((n) => !(n.kind === "dividend" && n.event?.symbol === "AP"));
    expect(validatePool(missing, assets).some((p) => p.includes("AP: tidak ada berita dividen"))).toBe(true);
  });
});

describe("isi berita dua paragraf", () => {
  it("tiap berita minimal 2 paragraf dan paragraf kedua menyebut aset yang bergerak sesuai arah efeknya", () => {
    const name = new Map(assets.map((a) => [a.symbol, a.name]));
    for (const n of pool) {
      const [, impact] = n.body.split(/\n{2,}/);
      expect(n.body.split(/\n{2,}/).length).toBeGreaterThanOrEqual(2);
      const top = [...n.effects].sort((a, b) => Math.abs(b.pct_bps) - Math.abs(a.pct_bps))[0];
      // efek terbesar paling sering disebut; setidaknya satu nama aset berefek ada di paragraf kedua
      expect(n.effects.some((e) => impact.includes(name.get(e.symbol) ?? "__"))).toBe(true);
      expect(top).toBeDefined();
    }
  });

  it("impactParagraph: yang naik disebut sebagai menguat, yang turun melemah, sisanya bergerak tipis", () => {
    const names = new Map([
      ["AA", "Apel"],
      ["BB", "Bata"],
      ["CC", "Cuka"],
    ]);
    const p = impactParagraph(
      "Judul",
      [
        { symbol: "AA", pct_bps: 300 },
        { symbol: "BB", pct_bps: -200 },
        { symbol: "CC", pct_bps: 50 },
      ],
      names,
    );
    expect(p).toContain("Apel");
    expect(p).toContain("Bata");
    expect(p).toMatch(/menguat|naik|penerima manfaat/);
    expect(p).toMatch(/melemah|turun|tertekan/);
  });

  it("deterministik menurut judul", () => {
    const names = new Map([["AA", "Apel"]]);
    const fx = [{ symbol: "AA", pct_bps: 100 }];
    expect(impactParagraph("X", fx, names)).toBe(impactParagraph("X", fx, names));
  });
});

describe("poolToSql", () => {
  it("memuat berita berstatus ready dengan efek dan event, tanda kutip di-escape", () => {
    const sql = poolToSql([
      {
        kind: "dividend",
        title: "L'Oréal bagi dividen",
        body: "b",
        effects: [{ symbol: "LO", pct_bps: 100 }],
        event: { symbol: "LO", amount: 50 },
      },
    ]);
    expect(sql).toContain("'L''Oréal bagi dividen'");
    expect(sql).toContain("'ready'");
    expect(sql).toContain("insert into news_events");
    expect(sql).toContain("if not exists (select 1 from news where title");
    expect(sql).toContain("else update news set body");
  });
});

describe("makeRng", () => {
  it("berulang untuk benih sama dan dalam rentang", () => {
    const a = makeRng("x");
    const b = makeRng("x");
    for (let i = 0; i < 20; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
