import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import assetsFile from "./data/assets.example.json";
import { decoysInText, parseHandMarkdown, scaleEffects, toPoolNews } from "./news-hand-lib";
import { DEFAULT_CONFIG, validatePool, type PoolAsset } from "./news-pool-lib";

const assets: PoolAsset[] = (assetsFile.assets as PoolAsset[]).map((a) => ({
  symbol: a.symbol,
  name: a.name,
  sector: a.sector,
}));

const EFEK = "AP +5.0 · MI -1.2 · SA +0.4 · XI +0.3 · TE -0.2 · NE +0.1 · KH -0.1 · DA +0.2 · MA -0.3 · IN +0.1";

const SAMPLE = `# Judul berkas

## Bagian

### H001 · Berita harga contoh
Paragraf satu.

Paragraf dua dengan komputasi awan.

**Efek:** ${EFEK}

### B001 · Contoh Garuda Indonesia pailit
Garuda Indonesia pailit.

**Efek:** ${EFEK}
**Event:** Bangkrut — GA (sisa harga 10%)

### S001 · Saham Samsung dihentikan
Samsung dihentikan.

**Efek:** ${EFEK}
**Event:** Suspensi — SA, 20 menit

### D001 · Telkom bagi dividen
Telkom Indonesia bagi dividen.

**Efek:** ${EFEK}
**Event:** Dividen — TE, 0.8% dari harga
`;

describe("parseHandMarkdown", () => {
  it("membaca judul, isi, efek (persen -> bps), dan keempat jenis event", () => {
    const { news, errors } = parseHandMarkdown(SAMPLE);
    expect(errors).toEqual([]);
    expect(news.map((n) => n.id)).toEqual(["H001", "B001", "S001", "D001"]);
    expect(news.map((n) => n.kind)).toEqual(["price", "bankrupt", "suspend", "dividend"]);
    expect(news[0].body).toBe("Paragraf satu.\n\nParagraf dua dengan komputasi awan.");
    expect(news[0].effects[0]).toEqual({ symbol: "AP", pct_bps: 500 });
    expect(news[0].effects[1]).toEqual({ symbol: "MI", pct_bps: -120 });
    expect(news[0].effects).toHaveLength(10);
    expect(news[0].event).toBeNull();
    expect(news[1].event).toEqual({ symbol: "GA", amount: 1000 });
    expect(news[2].event).toEqual({ symbol: "SA", amount: 20 });
    expect(news[3].event).toEqual({ symbol: "TE", amount: 80 });
  });

  it("menandai kesalahan format", () => {
    const bad = `### H002 · Tanpa efek\nIsi.\n\n### S002 · Event rusak\nIsi.\n\n**Efek:** ${EFEK}\n**Event:** Dividen — SA, 20 menit\n\n### H003 · Harga beracun\nIsi.\n\n**Efek:** ${EFEK}\n**Event:** Suspensi — AP, 10 menit\n`;
    const { errors } = parseHandMarkdown(bad, "x.md");
    expect(errors.some((e) => e.includes("H002") && e.includes("Efek"))).toBe(true);
    expect(errors.some((e) => e.includes("S002") && e.includes("tidak cocok"))).toBe(true);
    expect(errors.some((e) => e.includes("H003") && e.includes("tidak boleh"))).toBe(true);
  });
});

describe("scaleEffects", () => {
  it("mengalikan efek berarti, tidak menyentuh pengisi, dan membatasi pada cap", () => {
    const { news } = parseHandMarkdown(SAMPLE);
    const withBig = [{ ...news[0], effects: [...news[0].effects.slice(1), { symbol: "AP", pct_bps: 1200 }] }];
    const out = scaleEffects(withBig, 1.5, 1500)[0].effects;
    expect(out.find((e) => e.symbol === "MI")!.pct_bps).toBe(-180);
    expect(out.find((e) => e.symbol === "SA")!.pct_bps).toBe(40);
    expect(out.find((e) => e.symbol === "AP")!.pct_bps).toBe(1500);
  });
});

describe("laporan analisa dari teks tulis tangan", () => {
  it("menyebut pengecoh hanya bila kata kunci sifatnya benar-benar ada di isi", () => {
    const { news } = parseHandMarkdown(SAMPLE);
    const n = news[0]; // isi memuat "komputasi awan" (MI) dengan efek -1.2 % >= ambang -> bukan pengecoh
    expect(decoysInText(n).map((d) => d.symbol)).not.toContain("MI");
    const quiet = { ...n, effects: n.effects.map((e) => (e.symbol === "MI" ? { ...e, pct_bps: -20 } : e)) };
    expect(decoysInText(quiet).map((d) => d.symbol)).toContain("MI");
    const analysis = toPoolNews([quiet])[0].analysis;
    expect(analysis).toHaveLength(4);
    expect(analysis[3]).toContain("pengecoh");
  });
});

describe("kumpulan 650 berita tulis tangan (docs/berita-650)", () => {
  const dir = resolve(__dirname, "../docs/berita-650");
  const files = readdirSync(dir).filter((f) => /^berita-\d+\.md$/.test(f)).sort();
  const parsed = files.map((f) => parseHandMarkdown(readFileSync(resolve(dir, f), "utf8"), f));
  const news = parsed.flatMap((p) => p.news);
  const pool = toPoolNews(news);

  it("terbaca tanpa galat dan berjumlah 650 (470 harga, 30 bangkrut, 60 suspensi, 90 dividen)", () => {
    expect(parsed.flatMap((p) => p.errors)).toEqual([]);
    expect(pool).toHaveLength(650);
    const count = (k: string) => pool.filter((n) => n.kind === k).length;
    expect([count("price"), count("bankrupt"), count("suspend"), count("dividend")]).toEqual([470, 30, 60, 90]);
    expect(new Set(news.map((n) => n.id)).size).toBe(650);
  });

  it("lolos validasi kumpulan (10–15 aset, ≤ 1500 bps, tanpa nama perusahaan di berita harga, cakupan event)", () => {
    expect(validatePool(pool, assets, DEFAULT_CONFIG, { hand: true })).toEqual([]);
  });

  it("tiap aset punya tepat 1 bangkrut, 2 suspensi, 3 dividen; subjek suspensi turun, subjek dividen naik", () => {
    for (const a of assets) {
      const of = (k: string) => pool.filter((n) => n.kind === k && n.event?.symbol === a.symbol);
      expect([of("bankrupt").length, of("suspend").length, of("dividend").length]).toEqual([1, 2, 3]);
    }
    for (const n of pool) {
      const own = n.effects.find((e) => e.symbol === n.event?.symbol)?.pct_bps;
      if (n.kind === "suspend") expect(own!).toBeLessThan(0);
      if (n.kind === "dividend") expect(own!).toBeGreaterThan(0);
    }
  });

  it("saldo efek tiap aset di seluruh kumpulan tidak menyimpang jauh (|jumlah| ≤ 40 % poin)", () => {
    const sum = new Map<string, number>();
    for (const n of pool) for (const e of n.effects) sum.set(e.symbol, (sum.get(e.symbol) ?? 0) + e.pct_bps);
    for (const [, v] of sum) expect(Math.abs(v)).toBeLessThanOrEqual(4000);
  });

  it("nilai event berada dalam batas database (dividen 10–1000 bps, suspensi 1–30 menit, bangkrut 0–5000 bps)", () => {
    for (const n of pool) {
      if (!n.event) continue;
      const [min, max] = n.kind === "dividend" ? [10, 1000] : n.kind === "suspend" ? [1, 30] : [0, 5000];
      expect(n.event.amount).toBeGreaterThanOrEqual(min);
      expect(n.event.amount).toBeLessThanOrEqual(max);
    }
  });

  it("tiap berita punya laporan analisa 4 paragraf", () => {
    for (const n of pool) expect(n.analysis).toHaveLength(4);
  });
});
