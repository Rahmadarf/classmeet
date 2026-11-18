/**
 * Logika murni untuk seed-dev.ts (tanpa jaringan), supaya bisa diuji vitest.
 * Aturan mengikuti docs/05-game-rules.md §5 (aset) dan docs/03-database.md §3.4, §3.8.
 */
import { randomInt } from "node:crypto";

export type AssetSeed = { sector: string; symbol: string; name: string; price: number };
export type NewsEffectSeed = { symbol: string; pct_bps: number };
export type NewsSeed = { title: string; body: string; effects: NewsEffectSeed[] };

export const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;
export const MIN_NEWS_ASSETS = 4;
export const MAX_NEWS_ASSETS = 7;
export const MAX_EFFECT_BPS = 1500;

/** Tingkatan stok doc 05 §5: makin murah makin banyak stoknya. */
export function stockForPrice(price: number): number {
  if (price <= 120_000) return 50;
  if (price <= 250_000) return 36;
  if (price <= 400_000) return 24;
  if (price <= 600_000) return 16;
  return 10;
}

/** Baris tabel `assets` dari data contoh: batas harga 30 % / 300 % harga awal (doc 05 §3). */
export function buildAssetRow(a: AssetSeed) {
  return {
    symbol: a.symbol,
    name: a.name,
    sector: a.sector,
    price: a.price,
    min_price: Math.round(a.price * 0.3),
    max_price: Math.round(a.price * 3),
    stock: stockForPrice(a.price),
  };
}

export function validateAssets(assets: AssetSeed[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const a of assets) {
    if (!SYMBOL_RE.test(a.symbol)) problems.push(`${a.symbol}: simbol tidak valid`);
    if (seen.has(a.symbol)) problems.push(`${a.symbol}: simbol ganda`);
    seen.add(a.symbol);
    if (!Number.isInteger(a.price) || a.price <= 0)
      problems.push(`${a.symbol}: harga bukan bilangan bulat positif`);
    // price_step bawaan Rp 100 dan harga harus di atas Rp 1.000 agar efek 8–14 % tidak hilang oleh pembulatan.
    if (a.price % 100 !== 0 || a.price <= 1_000)
      problems.push(`${a.symbol}: harga harus kelipatan 100 dan > 1.000`);
    const row = buildAssetRow(a);
    if (!(row.min_price <= a.price && a.price <= row.max_price))
      problems.push(`${a.symbol}: harga di luar batas`);
  }
  return problems;
}

export function validateNews(news: NewsSeed[], symbols: Set<string>): string[] {
  const problems: string[] = [];
  const titles = new Set<string>();
  for (const n of news) {
    const tag = `"${n.title}"`;
    if (!n.title.trim() || !n.body.trim()) problems.push(`${tag}: judul/isi kosong`);
    if (titles.has(n.title)) problems.push(`${tag}: judul ganda`);
    titles.add(n.title);
    if (n.effects.length < MIN_NEWS_ASSETS || n.effects.length > MAX_NEWS_ASSETS) {
      problems.push(`${tag}: jumlah aset ${n.effects.length}, harus ${MIN_NEWS_ASSETS}–${MAX_NEWS_ASSETS}`);
    }
    const inNews = new Set<string>();
    for (const e of n.effects) {
      if (!symbols.has(e.symbol)) problems.push(`${tag}: simbol ${e.symbol} tidak ada`);
      if (inNews.has(e.symbol)) problems.push(`${tag}: aset ganda ${e.symbol}`);
      inNews.add(e.symbol);
      if (!Number.isInteger(e.pct_bps) || e.pct_bps === 0 || Math.abs(e.pct_bps) > MAX_EFFECT_BPS) {
        problems.push(`${tag}: efek ${e.symbol} ${e.pct_bps} bps tidak valid (≠ 0, ≤ ${MAX_EFFECT_BPS})`);
      }
    }
  }
  return problems;
}

/** Kode cadangan 6 karakter, tanpa 0/O/1/I (doc 03 §3.2). Tidak dipakai UI v1, tetapi kolomnya wajib. */
const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateShortCode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)];
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  throw new Error("Gagal membuat short_code unik");
}

/** Kata sandi acak untuk akun non-tim (tanpa karakter yang mudah tertukar). */
export function randomPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
