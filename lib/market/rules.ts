/**
 * Aturan order book yang dicerminkan di klien HANYA untuk tampilan dan estimasi (stepper harga, ringkasan,
 * pesan isian). Penentu sebenarnya selalu database (`place_order`, docs/04 §3.1; docs/12): klien tidak
 * pernah menolak atau membatasi order sendiri.
 */
import { orderFee, tickFor } from "@/lib/money";

/** Satu fraksi ke atas: harga + tick_for(harga). */
export function stepUp(price: number): number {
  return price + tickFor(price);
}

/**
 * Satu fraksi ke bawah: kelipatan fraksi terbesar di bawah harga (floor_tick(harga − 1)).
 * Perlu begitu karena fraksi berubah di batas rentang (mis. 500.000 → 499.000, bukan 497.500).
 * Tidak pernah turun di bawah satu fraksi.
 */
export function stepDown(price: number): number {
  const below = price - 1;
  const tick = tickFor(below);
  return Math.max(Math.floor(below / tick) * tick, tickFor(1));
}

/** Kunci per lot order beli limit: harga + ceil(harga × fee_bps / 10000) (docs/04 §3.1). */
export function lockPerLot(price: number, feeBps: number): number {
  return price + orderFee(price, 1, feeBps);
}

/** Lot beli maksimum yang cukup untuk saldo bebas pada harga limit tertentu (untuk pesan setelah ditolak). */
export function maxAffordableLots(cash: number, price: number, feeBps: number): number {
  if (!(price > 0) || cash <= 0) return 0;
  return Math.floor(cash / lockPerLot(price, feeBps));
}

export type BookLevel = { price: number; lots: number; freq: number; mine: number };

export type SweepEstimate = {
  /** Lot yang kira-kira terisi (maks `sweepLevels` level, tanpa order milik sendiri). */
  filled: number;
  /** Jumlah uang kotor (Σ harga × lot) dan biaya (dibulatkan ke atas per level). */
  gross: number;
  fee: number;
};

/**
 * Perkiraan order market: menyapu level terbaik berurutan (maks `sweepLevels`), melewati lot milik sendiri
 * (self-trade dilewati di server). Hanya estimasi: antrean berubah sampai order tiba di server.
 * `levels` harus berurut dari terbaik (bid tertinggi / offer terendah).
 */
export function estimateSweep(
  levels: BookLevel[],
  qty: number,
  sweepLevels: number,
  feeBps: number,
): SweepEstimate {
  let left = qty;
  let gross = 0;
  let fee = 0;
  let filled = 0;
  for (const level of levels.slice(0, sweepLevels)) {
    if (left <= 0) break;
    const available = Math.max(level.lots - level.mine, 0);
    const take = Math.min(left, available);
    if (take <= 0) continue;
    gross += level.price * take;
    fee += orderFee(level.price, take, feeBps);
    filled += take;
    left -= take;
  }
  return { filled, gross, fee };
}

/** 38_300_000 → "38,3 jt"; 1_250_000_000 → "1,3 M"; di bawah sejuta ditulis penuh dengan pemisah ribuan. */
export function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string) => `${n.toFixed(1).replace(".", ",").replace(/,0$/, "")} ${unit}`;
  if (abs >= 1_000_000_000) return fmt(value / 1_000_000_000, "M");
  if (abs >= 1_000_000) return fmt(value / 1_000_000, "jt");
  return new Intl.NumberFormat("id-ID").format(value);
}

/** 25 → "0,25 %" (basis poin → persen, koma desimal). */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")} %`;
}
