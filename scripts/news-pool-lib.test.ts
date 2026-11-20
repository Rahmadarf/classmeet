import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import { ASSET_TRAITS } from "./data/asset-traits";
import { NOISE_BY_SECTOR, NOISE_GENERIC } from "./data/news-noise";
import {
  buildPool,
  DEFAULT_CONFIG,
  hintSentence,
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

describe("isi berita dua paragraf dengan petunjuk sifat", () => {
  it("tiap berita minimal 2 paragraf; paragraf kedua memuat petunjuk sifat dan dua kalimat pengecoh", () => {
    for (const n of pool) {
      const parts = n.body.split(/\n{2,}/);
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(parts[1]).toContain("Di sisi lain, ");
      expect(parts[1]).toMatch(/\. (Selain itu|Sementara itu|Pada waktu yang sama), /);
    }
  });

  it("berita harga tidak menyebut nama perusahaan; berita event hanya menyebut subjeknya", () => {
    for (const n of pool) {
      for (const a of assets) {
        const re = new RegExp(
          `(?<![\\p{L}])${a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`,
          "u",
        );
        const mentioned = re.test(n.body) || re.test(n.title);
        expect(mentioned).toBe(n.event?.symbol === a.symbol);
      }
    }
  });

  it("aset naik dan turun terbesar punya frasa sifatnya di paragraf kedua (kecuali subjek event)", () => {
    expect(validatePool(pool, assets).filter((p) => p.includes("petunjuk"))).toEqual([]);
    const sample = pool.find((n) => n.kind === "price")!;
    expect(sample.body.split(/\n{2,}/)[1]).toMatch(/Perusahaan yang|perusahaan yang/);
  });

  it("hintSentence: sifat aset naik disebut menguntungkan, yang turun tertekan; deterministik; tanpa nama aset", () => {
    const fx = [
      { symbol: "KA", pct_bps: 300 },
      { symbol: "AD", pct_bps: -200 },
      { symbol: "IN", pct_bps: 50 },
    ];
    const a = hintSentence("Judul", fx);
    expect(a).toBe(hintSentence("Judul", fx));
    expect(a).not.toMatch(/Kalbe|Adaro|Indofood/);
    expect(a).toMatch(/keuntungan|menguat|posisi menguntungkan|memanfaatkan/);
    expect(a).toMatch(/tertekan|melemah|negatif|tekanan/);
    expect(hintSentence("Judul", fx, ["KA", "IN"])).not.toMatch(/obat bebas|vitamin|apotek|mi instan/);
    expect(hintSentence("Judul", [], [])).toContain("terbatas");
  });

  it("kalimat pengecoh tidak memuat kata kunci sifat aset mana pun", () => {
    const keys = Object.values(ASSET_TRAITS).flatMap((t) => t.keys);
    const all = [...NOISE_GENERIC, ...Object.values(NOISE_BY_SECTOR).flat()];
    for (const sentence of all)
      for (const k of keys)
        expect(
          new RegExp(`(?<![\\p{L}])${k}(?![\\p{L}])`, "iu").test(sentence),
          `"${sentence}" memuat "${k}"`,
        ).toBe(false);
  });

  it("kamus sifat: 30 aset, tiap frasa memuat kata kuncinya, tidak ada kata kunci ganda antar aset", () => {
    expect(Object.keys(ASSET_TRAITS).sort()).toEqual(assets.map((a) => a.symbol).sort());
    const seen = new Map<string, string>();
    for (const [sym, t] of Object.entries(ASSET_TRAITS)) {
      expect(t.phrases.length).toBeGreaterThanOrEqual(3);
      expect(t.phrases.some((p) => t.keys.some((k) => p.includes(k)))).toBe(true);
      for (const k of t.keys) {
        expect(seen.has(k), `kata kunci "${k}" dipakai ${seen.get(k)} dan ${sym}`).toBe(false);
        seen.set(k, sym);
      }
    }
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
