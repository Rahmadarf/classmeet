/**
 * Pemuat berita TULIS TANGAN (docs/21): membaca `docs/berita-650/berita-*.md` menjadi `PoolNews` yang sama bentuknya dengan
 * keluaran pembuat otomatis (`buildPool`), sehingga `poolToSql`, `validatePool`, seed, dan simulasi tetap dipakai.
 * Logika murni (tanpa berkas/jaringan); pembacaan berkas ada di build-news-from-markdown.ts.
 *
 * Format satu berita:
 *   ### H001 · Judul                       (awalan H harga, B bangkrut, S suspensi, D dividen)
 *   Paragraf isi (satu atau lebih, dipisah baris kosong)
 *   **Efek:** CV +10.8 · GA -11.2 · ...   (persen perubahan harga acuan; disimpan sebagai bps = persen x 100)
 *   **Event:** Bangkrut — AP (sisa harga 10%) | Suspensi — SA, 20 menit | Dividen — TE, 0.8% dari harga
 * Laporan Analisa Pasar (`analysis`) TIDAK ditulis tangan: dibangkitkan dari efek dan kamus sifat (docs/16, docs/18).
 */
import { ASSET_TRAITS } from "./data/asset-traits";
import {
  analysisParagraphs,
  HINT_MIN_BPS,
  traitPhrase,
  type PoolEffect,
  type PoolKind,
  type PoolNews,
} from "./news-pool-lib";

const KIND_BY_PREFIX: Record<string, PoolKind> = { H: "price", B: "bankrupt", S: "suspend", D: "dividend" };
const HEADING_RE = /^### ([HBSD])(\d+) · (.+)$/;
const EFFECT_RE = /\b([A-Z]{2,8}) ([+\-−])(\d+(?:\.\d+)?)/g;

export type HandNews = Omit<PoolNews, "analysis"> & { id: string };

/** Parse satu berkas markdown (boleh berisi banyak berita dan judul bagian `##` yang diabaikan). */
export function parseHandMarkdown(text: string, source = "markdown"): { news: HandNews[]; errors: string[] } {
  const errors: string[] = [];
  const news: HandNews[] = [];
  const sections = text.split(/^(?=### )/m).filter((s) => s.startsWith("### "));
  for (const section of sections) {
    const lines = section.split("\n");
    const head = HEADING_RE.exec(lines[0].trim());
    if (!head) {
      errors.push(`${source}: judul bagian tidak dikenali: ${lines[0]}`);
      continue;
    }
    const id = `${head[1]}${head[2]}`;
    const kind = KIND_BY_PREFIX[head[1]];
    const title = head[3].trim();
    const bodyLines: string[] = [];
    let effectLine: string | null = null;
    let eventLine: string | null = null;
    for (const raw of lines.slice(1)) {
      const line = raw.trimEnd();
      if (line.startsWith("**Efek:**")) effectLine = line;
      else if (line.startsWith("**Event:**")) eventLine = line;
      else if (line.startsWith("#")) continue; // judul bagian berikutnya yang ikut terbawa
      else bodyLines.push(line);
    }
    const body = bodyLines
      .join("\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n");
    if (!effectLine) {
      errors.push(`${id}: baris **Efek:** tidak ada`);
      continue;
    }
    const effects: PoolEffect[] = [];
    for (const m of effectLine.matchAll(EFFECT_RE)) {
      const pct = Number(m[3]) * (m[2] === "+" ? 1 : -1);
      effects.push({ symbol: m[1], pct_bps: Math.round(pct * 100) });
    }
    let event: PoolNews["event"] = null;
    if (kind === "price") {
      if (eventLine) errors.push(`${id}: berita harga tidak boleh punya baris **Event:**`);
    } else if (!eventLine) {
      errors.push(`${id}: berita ${kind} tanpa baris **Event:**`);
    } else {
      const m =
        kind === "bankrupt"
          ? /Bangkrut — ([A-Z]{2,8}) \(sisa harga ([\d.]+)%\)/.exec(eventLine)
          : kind === "suspend"
            ? /Suspensi — ([A-Z]{2,8}), (\d+) menit/.exec(eventLine)
            : /Dividen — ([A-Z]{2,8}), ([\d.]+)% dari harga/.exec(eventLine);
      if (!m) errors.push(`${id}: baris **Event:** tidak cocok dengan jenis ${kind}: ${eventLine}`);
      else {
        const n = Number(m[2]);
        // bangkrut: bps likuidasi (sisa harga %); suspensi: menit; dividen: bps harga (persen x 100)
        event = { symbol: m[1], amount: kind === "suspend" ? n : Math.round(n * 100) };
      }
    }
    news.push({ id, kind, title, body, effects, event });
  }
  return { news, errors };
}

/** Kalikan efek berarti (>= HINT_MIN_BPS) dengan pengali, dibatasi `capBps`; efek pengisi tidak diubah. */
export function scaleEffects(news: HandNews[], scale: number, capBps: number): HandNews[] {
  if (scale === 1) return news;
  return news.map((n) => ({
    ...n,
    effects: n.effects.map((e) =>
      Math.abs(e.pct_bps) < HINT_MIN_BPS
        ? e
        : { ...e, pct_bps: Math.max(-capBps, Math.min(capBps, Math.round((e.pct_bps * scale) / 10) * 10)) },
    ),
  }));
}

/**
 * Pengecoh sifat yang BENAR-BENAR ada di teks: aset yang kata kunci sifatnya (kamus docs/16) muncul di isi, padahal efeknya
 * di bawah ambang petunjuk atau tidak ada. Laporan analisa menyebutnya pengecoh. Subjek event tidak dihitung.
 */
export function decoysInText(n: HandNews): { symbol: string; phrase: string }[] {
  const body = n.body.toLowerCase();
  const out: { symbol: string; phrase: string }[] = [];
  for (const [symbol, traits] of Object.entries(ASSET_TRAITS)) {
    if (symbol === n.event?.symbol) continue;
    if (!traits.keys.some((k) => body.includes(k.toLowerCase()))) continue;
    const e = n.effects.find((x) => x.symbol === symbol);
    if (e && Math.abs(e.pct_bps) >= HINT_MIN_BPS) continue;
    out.push({ symbol, phrase: traitPhrase(symbol, n.title)! });
  }
  return out.slice(0, 2);
}

/** Ubah berita hasil parse menjadi `PoolNews` lengkap dengan laporan analisa dari efek sebenarnya. */
export function toPoolNews(news: HandNews[]): PoolNews[] {
  return news.map(({ id: _id, ...n }) => ({
    ...n,
    analysis: analysisParagraphs(n.title, n.kind, n.effects, n.event, decoysInText({ ...n, id: _id })),
  }));
}

/**
 * Peringatan (bukan galat) tentang petunjuk: berita harga yang aset naik atau turun terbesarnya (>= 4 %) sama sekali tidak
 * punya kata kunci sifatnya di isi. Penulis boleh memparafrasekan sifat, jadi ini hanya untuk ditinjau manusia.
 */
export function handHintWarnings(news: HandNews[]): string[] {
  const out: string[] = [];
  for (const n of news) {
    const body = n.body.toLowerCase();
    const strong = n.effects.filter((e) => Math.abs(e.pct_bps) >= 400 && e.symbol !== n.event?.symbol);
    if (strong.length === 0) continue;
    const hinted = strong.filter((e) => ASSET_TRAITS[e.symbol]?.keys.some((k) => body.includes(k.toLowerCase())));
    if (hinted.length === 0) out.push(`${n.id} "${n.title}": tidak ada kata kunci sifat aset berefek besar di isi`);
  }
  return out;
}
