import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import { ASSET_TRAITS } from "./data/asset-traits";
import { NOISE_BY_SECTOR, NOISE_GENERIC } from "./data/news-noise";
import {
  buildPool,
  decoyOf,
  DEFAULT_CONFIG,
  firstSentence,
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

  it("tiap aset: tepat 1 bangkrut, 5 suspensi, 10 dividen; total tepat 1100 berita", () => {
    expect(pool).toHaveLength(1100);
    for (const a of assets) {
      const count = (k: string) => pool.filter((n) => n.kind === k && n.event?.symbol === a.symbol).length;
      expect([count("bankrupt"), count("suspend"), count("dividend")]).toEqual([1, 5, 10]);
    }
  });

  it("tidak semua berita membawa event: berita harga mendominasi dan tanpa event", () => {
    const price = pool.filter((n) => n.kind === "price");
    expect(price.length).toBe(620);
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

  it("hintSentence (tingkat sulit): satu ciri naik dan satu turun terbesar saja, deterministik, tanpa nama aset", () => {
    const fx = [
      { symbol: "KA", pct_bps: 300 },
      { symbol: "SM", pct_bps: 150 },
      { symbol: "AD", pct_bps: -200 },
      { symbol: "PN", pct_bps: -120 },
      { symbol: "IN", pct_bps: 50 },
    ];
    const a = hintSentence("Judul", fx);
    expect(a).toBe(hintSentence("Judul", fx));
    expect(a).not.toMatch(/Kalbe|Adaro|Indofood|Sido|PLN/);
    const phrasesIn = (sym: string) => ASSET_TRAITS[sym].phrases.filter((p) => a.includes(p)).length;
    expect(phrasesIn("KA")).toBe(1); // naik terbesar
    expect(phrasesIn("SM")).toBe(0); // naik kedua tidak dibocorkan
    expect(phrasesIn("AD")).toBe(1); // turun terbesar
    expect(phrasesIn("PN")).toBe(0);
    expect(phrasesIn("IN")).toBe(0); // efek kecil tidak disebut
    expect(hintSentence("Judul", fx, ["KA", "AD"])).not.toMatch(
      /obat bebas|vitamin|apotek|minuman kesehatan|batu bara|tambang/,
    );
    expect(hintSentence("Judul", [], [])).toContain("terbatas");
  });

  it("sekitar separuh petunjuk tidak menyebut arah (harus ditebak dari topik)", () => {
    let neutral = 0;
    let directional = 0;
    for (const n of pool.filter((x) => x.kind === "price")) {
      const p2 = n.body.split(/\n{2,}/)[1];
      if (/merasakan dampak langsungnya|memantau perusahaan .* dengan saksama|paling peka/.test(p2))
        neutral++;
      if (
        /mendapat keuntungan|berpeluang menguat|posisi menguntungkan|berisiko tertekan|diperkirakan melemah|terdampak negatif/.test(
          p2,
        )
      )
        directional++;
    }
    expect(neutral).toBeGreaterThan(100);
    expect(directional).toBeGreaterThan(100);
  });

  it("pengecoh sifat: menyebut aset yang efeknya < 1 % atau tidak ada, dan laporan menyebutnya pengecoh", () => {
    for (const n of pool) {
      const d = decoyOf(n.title, n.effects, n.event ? [n.event.symbol] : []);
      expect(d).not.toBeNull();
      const fx = n.effects.find((e) => e.symbol === d!.symbol);
      expect(!fx || Math.abs(fx.pct_bps) < 100, `${n.title}: pengecoh ${d!.symbol} berefek berarti`).toBe(
        true,
      );
      expect(n.body.split(/\n{2,}/)[1]).toContain(d!.sentence);
      expect(n.analysis[3]).toContain(
        `Perusahaan yang ${d!.phrase}, yang sempat disebut di berita, hanyalah pengecoh`,
      );
    }
  });

  it("paragraf 1 hanya kalimat peristiwa: tanpa kalimat akibat per sektor", () => {
    for (const n of pool.filter((x) => x.kind === "price")) {
      const p1 = n.body.split(/\n{2,}/)[0];
      expect(p1).not.toMatch(/Pelaku sektor/);
    }
    expect(firstSentence("A satu. B dua. C tiga.")).toBe("A satu.");
    expect(firstSentence("Hanya satu kalimat tanpa titik")).toBe("Hanya satu kalimat tanpa titik");
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
        analysis: ["Efek {waktu}.", "Naik.", "Turun.", "Catatan."],
      },
    ]);
    expect(sql).toContain("'L''Oréal bagi dividen'");
    expect(sql).toContain("'ready'");
    expect(sql).toContain("insert into news_events");
    expect(sql).toContain("if not exists (select 1 from news where title");
    expect(sql).toContain("else update news set body");
    expect(sql).toContain("insert into news_analysis");
    expect(sql).toContain("on conflict (news_id) do update set paragraphs");
  });
});

describe("analisa pay to win (laporan 4 paragraf)", () => {
  const phraseOwner = new Map<string, string>();
  for (const [sym, t] of Object.entries(ASSET_TRAITS)) for (const p of t.phrases) phraseOwner.set(p, sym);

  it("setiap berita punya 4 paragraf, {waktu} hanya sekali di paragraf 1, tanpa nama perusahaan (lewat validatePool)", () => {
    for (const n of pool) {
      expect(n.analysis).toHaveLength(4);
      expect((n.analysis[0].match(/\{waktu\}/g) ?? []).length).toBe(1);
    }
    expect(validatePool(pool, assets)).toEqual([]);
  });

  it("frasa sifat unik per aset (satu frasa menunjuk tepat satu aset)", () => {
    const total = Object.values(ASSET_TRAITS).reduce((n, t) => n + t.phrases.length, 0);
    expect(phraseOwner.size).toBe(total);
  });

  it("isi benar menurut efek: ciri di paragraf 2 naik berarti, di paragraf 3 turun berarti, urut dari terbesar", () => {
    for (const n of pool) {
      for (const [idx, sign] of [
        [1, 1],
        [2, -1],
      ] as const) {
        const found: { at: number; mag: number }[] = [];
        for (const [phrase, sym] of phraseOwner) {
          const at = n.analysis[idx].indexOf(`perusahaan yang ${phrase} (`);
          if (at < 0) continue;
          const e = n.effects.find((x) => x.symbol === sym)!;
          expect(e, `${n.title}: ${sym} tidak punya efek`).toBeDefined();
          expect(Math.sign(e.pct_bps)).toBe(sign);
          expect(Math.abs(e.pct_bps)).toBeGreaterThanOrEqual(100);
          found.push({ at, mag: Math.abs(e.pct_bps) });
        }
        expect(found.length).toBeLessThanOrEqual(3);
        const ordered = found.sort((x, y) => x.at - y.at).map((f) => f.mag);
        expect(ordered, `${n.title}: urutan harus dari yang terbesar`).toEqual(
          [...ordered].sort((x, y) => y - x),
        );
      }
    }
  });

  it("paragraf naik/turun tanpa ciri menyatakannya, dan berita event mencatat jenisnya di paragraf 4", () => {
    const none = pool.filter((n) => n.effects.every((e) => e.pct_bps < 100));
    for (const n of none) expect(n.analysis[1]).toContain("Tidak ada ciri");
    for (const kind of ["bankrupt", "suspend", "dividend"] as const)
      for (const n of pool.filter((x) => x.kind === kind))
        expect(n.analysis[3]).toContain(
          { bankrupt: "kebangkrutan", suspend: "penghentian sementara", dividend: "dividen" }[kind],
        );
  });

  it("tidak mengubah judul, isi, atau efek berita yang sudah ada (deterministik, tanpa RNG utama)", () => {
    const a = buildPool(assets);
    expect(a.map((n) => [n.title, n.body, n.effects])).toEqual(pool.map((n) => [n.title, n.body, n.effects]));
    expect(a.map((n) => n.analysis)).toEqual(pool.map((n) => n.analysis));
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
