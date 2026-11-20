/**
 * Aturan toko yang dicerminkan di klien HANYA untuk tampilan dan estimasi (label stok, batas pegang, jumlah maksimal).
 * Penentu sebenarnya selalu database (`buy_asset` / `sell_asset`, docs/17): klien tidak pernah menolak transaksi sendiri.
 */

export type StockLevel = "out" | "low" | "mid" | "ok";

/** Label stok menurut sisa/stok awal: habis, "Langka" (< stockLowPct), kuning (< stockMidPct), hijau. */
export function stockLevel(stock: number, initStock: number, midPct: number, lowPct: number): StockLevel {
  if (stock <= 0) return "out";
  if (initStock <= 0) return "ok";
  const pct = (stock * 100) / initStock;
  if (pct < lowPct) return "low";
  if (pct < midPct) return "mid";
  return "ok";
}

/** Batas pegang per tim per aset: `holdCapPct` % stok awal, minimal 1 unit (sama dengan `buy_asset`). */
export function holdCap(initStock: number, holdCapPct: number): number {
  return Math.max(1, Math.floor((initStock * holdCapPct) / 100));
}

/** Harga jual dari harga tayang: dikurangi `spreadBps`, dibulatkan ke bawah ke kelipatan `step` (sama dengan `shop_sell_price`). */
export function sellPriceOf(listPrice: number, spreadBps: number, step = 100): number {
  return Math.max(step, Math.floor((listPrice * (10_000 - spreadBps)) / 10_000 / step) * step);
}

/**
 * Jumlah beli maksimal menurut batas yang diketahui klien: saldo, stok pasar, dan sisa batas pegang.
 * Hanya untuk pesan bantu dan nilai awal stepper; database yang memutuskan.
 */
export function maxBuyQty(opts: {
  cash: number | null;
  price: number;
  stock: number;
  held: number;
  cap: number;
}): number {
  const byCash = opts.cash === null || opts.price <= 0 ? Infinity : Math.floor(opts.cash / opts.price);
  return Math.max(0, Math.min(byCash, opts.stock, opts.cap - opts.held));
}

/** 38_300_000 → "38,3 jt"; 1_250_000_000 → "1,3 M"; di bawah sejuta ditulis penuh dengan pemisah ribuan. */
export function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string) => `${n.toFixed(1).replace(".", ",").replace(/,0$/, "")} ${unit}`;
  if (abs >= 1_000_000_000) return fmt(value / 1_000_000_000, "M");
  if (abs >= 1_000_000) return fmt(value / 1_000_000, "jt");
  return new Intl.NumberFormat("id-ID").format(value);
}

/** 200 → "2 %"; 25 → "0,25 %" (basis poin → persen, koma desimal, tanpa nol di belakang koma). */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",").replace(/,?0+$/, "")} %`;
}
