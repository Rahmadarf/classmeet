/**
 * Tata letak kartu pos pada layar publik dua zona (Tersedia | Tidak tersedia) di panggung 1920×1080.
 * Posisi dihitung di sini (bukan oleh CSS grid) supaya satu elemen kartu per pos tetap ada di DOM dan berpindah
 * antar zona lewat transisi `transform` saat statusnya berubah (pola yang sama dengan layar Peringkat).
 */

/** Ukuran area kartu di dalam satu zona (px, di panggung 1920×1080). */
export const AREA_W = 852;
export const AREA_H = 662;
export const GAP = 14;

export type ZoneLayout = {
  cols: number;
  rows: number;
  cardW: number;
  cardH: number;
  /** Ukuran huruf dan ubin turunan dari tinggi kartu. */
  name: number;
  place: number;
  tile: number;
  /** Lokasi (baris kedua) disembunyikan bila kartu terlalu pendek untuk dua baris. */
  showPlace: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Kolom menurut jumlah pos dalam zona: ≤ 5 satu kolom, ≤ 16 dua (nama tetap terbaca), ≤ 30 tiga, selebihnya empat. */
export function colsFor(n: number): number {
  return n <= 5 ? 1 : n <= 16 ? 2 : n <= 30 ? 3 : 4;
}

const MAX_CARD_H = [0, 112, 104, 92, 80];

export function zoneLayout(n: number): ZoneLayout {
  const cols = colsFor(Math.max(n, 1));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cardW = Math.floor((AREA_W - (cols - 1) * GAP) / cols);
  const cardH = Math.min(MAX_CARD_H[cols], Math.floor((AREA_H - (rows - 1) * GAP) / rows));
  return {
    cols,
    rows,
    cardW,
    cardH,
    name: clamp(Math.round(cardH * 0.3), 15, 34),
    place: clamp(Math.round(cardH * 0.2), 12, 22),
    tile: clamp(Math.round(cardH * 0.62), 26, 72),
    showPlace: cardH >= 56,
  };
}

/** Posisi kartu ke-`index` (urut dalam zonanya) relatif terhadap pojok kiri-atas area kartu. */
export function cardOffset(layout: ZoneLayout, index: number): { x: number; y: number } {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return { x: col * (layout.cardW + GAP), y: row * (layout.cardH + GAP) };
}
