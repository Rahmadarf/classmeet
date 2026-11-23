import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import { ASSET_TRAITS } from "./data/asset-traits";
import { NOISE_BY_SECTOR, NOISE_GENERIC } from "./data/news-noise";
import { CITIES, ORGANIZATIONS, PEOPLE, QUOTES, SCENES, SOURCES } from "./data/news-voices";
import {
  buildPool,
  decoysOf,
  HINT_DOWN,
  HINT_UP,
  NEUTRAL_TEMPLATES,
  DEFAULT_CONFIG,
  firstSentence,
  genreOf,
  hintClauses,
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
const allPhrases = Object.values(ASSET_TRAITS).flatMap((t) => t.phrases);
/** Templat berisi {x}: jadikan ungkapan reguler untuk mengenali kalimat yang dibuat dari templat itu. */
const templateRegex = (t: string) =>
  new RegExp("^" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{x\\}", "yang .+?") + "$", "i");
const neutralRegexes = NEUTRAL_TEMPLATES.map(templateRegex);
const upRegexes = HINT_UP.map(templateRegex);
const downRegexes = HINT_DOWN.map(templateRegex);
/** Kalimat di paragraf 2 tanpa penyambung di depan dan dengan huruf pertama dinormalkan, untuk mencocokkan templat. */
const bare = (sentence: string) => {
  let t = sentence.trim();
  for (const c of [
    "Di sisi lain, ",
    "Selain itu, ",
    "Sementara itu, ",
    "Pada waktu yang sama, ",
    "Terpisah dari itu, ",
    "Dalam kabar lain, ",
  ])
    if (t.startsWith(c)) t = t.slice(c.length);
  return t[0].toUpperCase() + t.slice(1);
};

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
  it("tiap berita minimal 2 paragraf; paragraf kedua memuat petunjuk sifat dan sedikitnya satu pengecoh topik", () => {
    for (const n of pool) {
      const parts = n.body.split(/\n{2,}/);
      expect(parts.length).toBeGreaterThanOrEqual(2);
      const sentences = parts[1].split(/(?<=\.)\s+/);
      expect(sentences.length, n.title).toBeGreaterThanOrEqual(2);
      const noiseCount = sentences.filter((x) => !allPhrases.some((ph) => x.includes(ph))).length;
      expect(noiseCount, `${n.title}: tanpa pengecoh topik`).toBeGreaterThanOrEqual(1);
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

  it("sekitar separuh petunjuk tidak menyebut arah (rumusan netral), separuh lagi berarah", () => {
    let neutral = 0;
    let directional = 0;
    for (const n of pool.filter((x) => x.kind === "price")) {
      for (const c of hintClauses(n.title, n.effects)) {
        if (neutralRegexes.some((r) => r.test(c))) neutral++;
        else directional++;
      }
    }
    expect(neutral).toBeGreaterThan(200);
    expect(directional).toBeGreaterThan(200);
    expect(Math.abs(neutral - directional) / (neutral + directional)).toBeLessThan(0.15);
  });

  it("pengecoh sifat (0-2 per berita): aset yang efeknya < 1 % atau tidak ada; laporan menyebutnya pengecoh", () => {
    let withDecoy = 0;
    for (const n of pool) {
      const ds = decoysOf(n.title, n.effects, n.event ? [n.event.symbol] : []);
      expect(ds.length).toBeLessThanOrEqual(2);
      if (ds.length) withDecoy++;
      const p2 = n.body.split(/\n{2,}/)[1];
      for (const d of ds) {
        const fx = n.effects.find((e) => e.symbol === d.symbol);
        expect(!fx || Math.abs(fx.pct_bps) < 100, `${n.title}: pengecoh ${d.symbol} berefek berarti`).toBe(
          true,
        );
        expect(p2).toContain(`yang ${d.phrase}`);
        expect(n.analysis[3]).toContain(`perusahaan yang ${d.phrase}`);
        expect(n.analysis[3]).toContain("hanyalah pengecoh");
      }
      if (ds.length === 0) expect(n.analysis[3]).not.toContain("hanyalah pengecoh");
    }
    expect(withDecoy / pool.length).toBeGreaterThan(0.7);
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

describe("struktur berita tanpa ciri khas (tidak ada pola yang membocorkan pengecoh)", () => {
  const price = pool.filter((n) => n.kind === "price");
  const sentencesOf = (n: (typeof pool)[number]) => n.body.split(/\n{2,}/)[1].split(/(?<=\.)\s+/);
  const maskKerangka = (n: (typeof pool)[number]) => {
    let t = n.body.split(/\n{2,}/)[1];
    for (const ph of allPhrases) t = t.split(ph).join("<CIRI>");
    for (const nz of noiseAll) {
      t = t.split(nz).join("<N>");
      t = t.split(nz[0].toUpperCase() + nz.slice(1)).join("<N>");
    }
    return t;
  };
  const noiseAll = [...NOISE_GENERIC, ...Object.values(NOISE_BY_SECTOR).flat()];

  it("kerangka paragraf kedua beragam: sedikitnya 80 % unik dan tak ada yang dipakai lebih dari 2 % berita", () => {
    const counts = new Map<string, number>();
    for (const n of price) counts.set(maskKerangka(n), (counts.get(maskKerangka(n)) ?? 0) + 1);
    expect(counts.size / price.length).toBeGreaterThan(0.8);
    expect(Math.max(...counts.values()) / price.length).toBeLessThan(0.02);
  });

  it('tidak ada penyambung wajib: "Di sisi lain," muncul di bawah 35 % berita, dan penyambung acak tidak tetap di satu posisi', () => {
    const withDi = pool.filter((n) => n.body.split(/\n{2,}/)[1].includes("Di sisi lain,")).length;
    expect(withDi / pool.length).toBeLessThan(0.35);
    expect(withDi / pool.length).toBeGreaterThan(0.05);
    // kalimat pertama paragraf kedua tidak pernah diawali penyambung
    for (const n of pool)
      expect(sentencesOf(n)[0]).not.toMatch(
        /^(Di sisi lain|Selain itu|Sementara itu|Pada waktu yang sama|Terpisah dari itu|Dalam kabar lain),/,
      );
  });

  it("urutan acak: petunjuk, pengecoh sifat, dan pengecoh topik tidak selalu berurutan sama", () => {
    const firstIsNoise = price.filter((n) => !allPhrases.some((ph) => sentencesOf(n)[0].includes(ph))).length;
    expect(firstIsNoise / price.length).toBeGreaterThan(0.15);
    expect(firstIsNoise / price.length).toBeLessThan(0.7);
  });

  it("tidak ada templat yang mendominasi: tiap templat dipakai di bawah 25 % berita", () => {
    const all = [...neutralRegexes, ...upRegexes, ...downRegexes];
    const hits = all.map(() => 0);
    for (const n of pool) {
      const bares = sentencesOf(n).map(bare);
      all.forEach((r, i) => {
        if (bares.some((x) => r.test(x))) hits[i]++;
      });
    }
    expect(Math.max(...hits) / pool.length).toBeLessThan(0.25);
    expect(Math.min(...hits)).toBeGreaterThan(0); // semua rumusan terpakai
  });

  it("pengecoh sifat dan petunjuk tanpa arah memakai rumusan YANG SAMA (tidak bisa dibedakan dari bentuk)", () => {
    const decoyTemplates = new Set<number>();
    const neutralHintTemplates = new Set<number>();
    for (const n of pool) {
      for (const d of decoysOf(n.title, n.effects, n.event ? [n.event.symbol] : [])) {
        const i = neutralRegexes.findIndex((r) =>
          r.test(bare(sentencesOf(n).find((x) => x.includes(`yang ${d.phrase}`))!)),
        );
        expect(i, `${n.title}: pengecoh bukan rumusan netral`).toBeGreaterThanOrEqual(0);
        decoyTemplates.add(i);
      }
      for (const c of hintClauses(n.title, n.effects)) {
        const i = neutralRegexes.findIndex((r) => r.test(c));
        if (i >= 0) neutralHintTemplates.add(i);
      }
    }
    expect([...decoyTemplates].sort()).toEqual([...neutralHintTemplates].sort());
    expect(decoyTemplates.size).toBe(NEUTRAL_TEMPLATES.length);
  });

  it("penyambung tidak menandai jenis kalimat: porsi kalimat bersambung mirip untuk pengecoh topik dan kalimat ciri", () => {
    let noiseWith = 0,
      noiseAll_ = 0,
      traitWith = 0,
      traitAll = 0;
    for (const n of pool) {
      for (const [i, s2] of sentencesOf(n).entries()) {
        if (i === 0) continue;
        const hasConn =
          /^(Di sisi lain|Selain itu|Sementara itu|Pada waktu yang sama|Terpisah dari itu|Dalam kabar lain), /.test(
            s2,
          );
        if (allPhrases.some((ph) => s2.includes(ph))) {
          traitAll++;
          if (hasConn) traitWith++;
        } else {
          noiseAll_++;
          if (hasConn) noiseWith++;
        }
      }
    }
    expect(Math.abs(noiseWith / noiseAll_ - traitWith / traitAll)).toBeLessThan(0.12);
  });

  it("dalam satu berita: tidak ada rumusan yang sama dua kali dan tidak ada penyambung yang sama berurutan", () => {
    const all = [...neutralRegexes, ...upRegexes, ...downRegexes];
    for (const n of pool) {
      const bares = sentencesOf(n).map(bare);
      all.forEach((r, i) => {
        expect(
          bares.filter((x) => r.test(x)).length,
          `${n.title}: rumusan ${i} dua kali`,
        ).toBeLessThanOrEqual(1);
      });
      let prev = "";
      for (const sx of sentencesOf(n)) {
        const m =
          /^(Di sisi lain|Selain itu|Sementara itu|Pada waktu yang sama|Terpisah dari itu|Dalam kabar lain), /.exec(
            sx,
          );
        if (m) expect(m[1], `${n.title}: penyambung berulang`).not.toBe(prev);
        prev = m ? m[1] : "";
      }
    }
  });

  it("tata bahasa: tidak ada kata ganda 'dengan ... dengan saksama' dan tidak ada 'Nama perusahaan yang'", () => {
    for (const n of pool) {
      expect(n.body).not.toMatch(/dengan [^.]*dengan saksama/);
      expect(n.body).not.toMatch(/Nama perusahaan yang/);
      expect(n.body).not.toMatch(/\.\./);
    }
  });
});

describe("genre dan tekstur (suara fiktif, pengecoh yang wajar)", () => {
  const keys = Object.values(ASSET_TRAITS).flatMap((t) => t.keys);
  const keyRe = (k: string) => new RegExp(`(?<![\\p{L}])${k}(?![\\p{L}])`, "iu");

  it("bank pengecoh topik besar dan unik (>= 150), dan tak satu kalimat pun dipakai di > 3 % berita", () => {
    const all = [...NOISE_GENERIC, ...Object.values(NOISE_BY_SECTOR).flat()];
    expect(all.length).toBeGreaterThanOrEqual(150);
    expect(new Set(all).size).toBe(all.length);
    let maxShare = 0;
    for (const nz of all) {
      const used = pool.filter((n) =>
        n.body
          .split(/\n{2,}/)[1]
          .toLowerCase()
          .includes(nz.toLowerCase()),
      ).length;
      maxShare = Math.max(maxShare, used / pool.length);
    }
    expect(maxShare).toBeLessThan(0.03);
  });

  it("suara fiktif (kota, tokoh, lembaga, sumber, kutipan, adegan) tidak memuat kata kunci sifat maupun nama aset", () => {
    const voices = [...CITIES, ...PEOPLE.flat(), ...ORGANIZATIONS, ...SOURCES, ...QUOTES, ...SCENES];
    for (const v of voices) {
      for (const k of keys) expect(keyRe(k).test(v), `"${v}" memuat "${k}"`).toBe(false);
      for (const a of assets)
        expect(new RegExp(`(?<![\\p{L}])${a.name}(?![\\p{L}])`, "u").test(v), `"${v}" memuat ${a.name}`).toBe(
          false,
        );
    }
  });

  it("genre tersebar: tak ada genre > 45 % dan tiap genre >= 5 %; tiap genre punya ciri tekstnya", () => {
    const counts = new Map<string, number>();
    for (const n of pool) counts.set(genreOf(n.title), (counts.get(genreOf(n.title)) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual(["kutipan", "lapangan", "lurus", "rilis", "singkat", "sumber"]);
    for (const [g, c] of counts) {
      expect(c / pool.length, g).toBeLessThan(0.45);
      expect(c / pool.length, g).toBeGreaterThanOrEqual(0.05);
    }
    for (const n of pool) {
      const p1 = n.body.split(/\n{2,}/)[0];
      switch (genreOf(n.title)) {
        case "singkat":
          expect(p1).toMatch(/^[A-Z ]+ — /);
          break;
        case "kutipan":
          expect(p1).toMatch(/"[^"]+," kata [A-Z][a-z]+ [A-Z][a-z]+, /);
          break;
        case "sumber":
          expect(p1).toContain("Informasi itu dihimpun dari ");
          break;
        case "rilis":
          expect(p1).toContain("dalam keterangan tertulis.");
          break;
        case "lapangan":
          expect(p1).toMatch(/(^|[.!?] )Di [a-zA-Z]+/);
          break;
        default:
          expect(p1).not.toMatch(/ — |kata [A-Z]|Informasi itu dihimpun|keterangan tertulis/);
      }
    }
  });

  it("genre singkat: tanpa komentar netral dan hanya satu pengecoh topik; berita event tetap menyebut subjeknya", () => {
    for (const n of pool.filter((x) => genreOf(x.title) === "singkat")) {
      expect(n.body.split(/\n{2,}/)[0].split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(
        n.kind === "price" ? 1 : 3,
      );
    }
    for (const n of pool.filter((x) => x.event)) {
      const name = assets.find((a) => a.symbol === n.event!.symbol)!.name;
      expect(n.body.split(/\n{2,}/)[0]).toContain(name);
    }
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
