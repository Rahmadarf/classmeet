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
 * Model harga satu aset untuk menghitung total beli/jual (cermin `buy_asset`/`sell_asset`, scripts/sql/trading-impact.sql):
 * harga bergerak satu langkah tekanan (`pressureBps`) per unit DI DALAM transaksi, jadi total tidak sama dengan unit x harga tayang.
 */
export type PriceModel = {
  refPrice: number;
  minPrice: number;
  maxPrice: number;
  factorBps: number;
  step: number;
  pressureBps: number;
  capBps: number;
  spreadBps: number;
};

/** Harga tayang pada faktor tekanan tertentu (sama dengan `shop_price`: dibulatkan ke kelipatan `step`, dibatasi min/maks). */
export function shopPriceAt(m: PriceModel, factorBps: number): number {
  const raw = Math.round((m.refPrice * (10_000 + factorBps)) / 10_000 / m.step) * m.step;
  return Math.max(m.minPrice, Math.min(m.maxPrice, raw));
}

/** Total beli `qty` unit: unit ke-i (mulai 0) dibayar pada faktor min(batas, faktor + i x langkah). */
export function buyTotal(m: PriceModel, qty: number): number {
  let total = 0;
  for (let i = 0; i < qty; i++) total += shopPriceAt(m, Math.min(m.capBps, m.factorBps + i * m.pressureBps));
  return total;
}

/** Total jual `qty` unit: unit ke-j (mulai 0) diterima pada harga jual faktor maks(−batas, faktor − j x langkah). */
export function sellTotal(m: PriceModel, qty: number): number {
  let total = 0;
  for (let j = 0; j < qty; j++)
    total += sellPriceOf(
      shopPriceAt(m, Math.max(-m.capBps, m.factorBps - j * m.pressureBps)),
      m.spreadBps,
      m.step,
    );
  return total;
}

/**
 * Jumlah beli maksimal menurut batas yang diketahui klien: saldo, stok pasar, dan sisa batas pegang.
 * `total(qty)` (opsional) menghitung biaya sebenarnya dengan tekanan di dalam transaksi; tanpa itu dipakai `price` x unit.
 * Hanya untuk pesan bantu dan nilai awal stepper; database yang memutuskan.
 */
export function maxBuyQty(opts: {
  cash: number | null;
  price: number;
  stock: number;
  held: number;
  cap: number;
  total?: (qty: number) => number;
}): number {
  const limit = Math.max(0, Math.min(opts.stock, opts.cap - opts.held));
  if (opts.cash === null) return limit;
  if (!opts.total) return Math.min(opts.price <= 0 ? Infinity : Math.floor(opts.cash / opts.price), limit);
  let n = 0;
  while (n < limit && opts.total(n + 1) <= opts.cash) n++;
  return n;
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
