// Fungsi murni untuk memeriksa dan mensimulasikan kumpulan berita.
// Rumus harga SAMA dengan database (process_news_cycle / news_would_hit_bounds):
//   baru = ((harga * (10000 + bps)) / 10000 + step/2) / step * step   (pembagian bilangan bulat)

export type Asset = { symbol: string; price: number; min_price: number; max_price: number; is_active?: boolean };
export type Effect = { simbol: string; persen: number };
export type NewsItem = { judul: string; isi: string; efek: Effect[] };

export const RULES = { minAssets: 4, maxAssets: 7, maxBps: 1500, priceStep: 100 };

export const toBps = (persen: number): number => Math.round(persen * 100);

export function applyBps(price: number, bps: number, step = RULES.priceStep): number {
  const a = Math.floor((price * (10000 + bps)) / 10000);
  return Math.floor((a + Math.floor(step / 2)) / step) * step;
}

/** Hasil efek setelah dijepit ke min/maks (seperti di database saat diterapkan). */
export function applyClamped(a: Asset, bps: number, step = RULES.priceStep): number {
  return Math.max(a.min_price, Math.min(a.max_price, applyBps(a.price, bps, step)));
}

/** Sama dengan news_would_hit_bounds: hasil TANPA dijepit di luar [min, maks] = berita tertahan. */
export function wouldHitBounds(item: NewsItem, assets: Map<string, Asset>, step = RULES.priceStep): boolean {
  return item.efek.some((e) => {
    const a = assets.get(e.simbol);
    if (!a || a.is_active === false) return false;
    const v = applyBps(a.price, toBps(e.persen), step);
    return v < a.min_price || v > a.max_price;
  });
}

/** Aturan statis per berita. Mengembalikan daftar masalah (kosong = lolos). */
export function validateItem(item: NewsItem, symbols: Set<string>): string[] {
  const err: string[] = [];
  if (!item.judul || !item.judul.trim()) err.push("judul kosong");
  if (!item.isi || !item.isi.trim()) err.push("isi kosong");
  if (!Array.isArray(item.efek)) { err.push("efek bukan daftar"); return err; }
  if (item.efek.length < RULES.minAssets || item.efek.length > RULES.maxAssets)
    err.push(`jumlah aset terkena efek ${item.efek.length}, harus ${RULES.minAssets}-${RULES.maxAssets}`);
  const seen = new Set<string>();
  for (const e of item.efek) {
    if (!symbols.has(e.simbol)) err.push(`simbol tidak dikenal: ${e.simbol}`);
    if (seen.has(e.simbol)) err.push(`aset ganda: ${e.simbol}`);
    seen.add(e.simbol);
    const bps = toBps(e.persen);
    if (!Number.isFinite(e.persen) || bps === 0) err.push(`persen nol/tidak valid untuk ${e.simbol}`);
    else if (Math.abs(bps) > RULES.maxBps) err.push(`${e.simbol}: ${e.persen}% melebihi ±${RULES.maxBps / 100}%`);
  }
  return err;
}

export type SimReport = {
  runs: number; steps: number; exhaustedRuns: number; exhaustedPct: number;
  meanStepsDone: number; firstExhaustionStep: number | null;
  perAsset: Record<string, { touches: number; netPct: number; minSeen: number; maxSeen: number; meanFinal: number }>;
};

/** Simulasi Monte Carlo: berita ready dipilih acak, calon yang menabrak batas dibuang, sampai `steps` berita. */
export function simulate(items: NewsItem[], assets: Asset[], steps = 220, runs = 2000, step = RULES.priceStep, rng: () => number = Math.random): SimReport {
  const per: SimReport["perAsset"] = {};
  const touches: Record<string, number> = {}, net: Record<string, number> = {};
  for (const a of assets) { touches[a.symbol] = 0; net[a.symbol] = 0; per[a.symbol] = { touches: 0, netPct: 0, minSeen: a.price, maxSeen: a.price, meanFinal: 0 }; }
  for (const it of items) for (const e of it.efek) if (touches[e.simbol] !== undefined) { touches[e.simbol]++; net[e.simbol] += e.persen; }
  let exhausted = 0, doneSum = 0, firstEx: number | null = null;
  const finalSum: Record<string, number> = {};
  for (const a of assets) finalSum[a.symbol] = 0;
  for (let r = 0; r < runs; r++) {
    const cur = new Map<string, Asset>(assets.map((a) => [a.symbol, { ...a }]));
    const pool = items.slice();
    let done = 0;
    for (; done < steps; done++) {
      const ok: number[] = [];
      for (let i = 0; i < pool.length; i++) if (!wouldHitBounds(pool[i], cur, step)) ok.push(i);
      if (ok.length === 0) { exhausted++; if (firstEx === null || done < firstEx) firstEx = done; break; }
      const idx = ok[Math.floor(rng() * ok.length)];
      const it = pool.splice(idx, 1)[0];
      for (const e of it.efek) {
        const a = cur.get(e.simbol); if (!a) continue;
        a.price = applyClamped(a, toBps(e.persen), step);
        const p = per[e.simbol]; p.minSeen = Math.min(p.minSeen, a.price); p.maxSeen = Math.max(p.maxSeen, a.price);
      }
    }
    doneSum += done;
    for (const [s, a] of cur) finalSum[s] += a.price;
  }
  for (const a of assets) { per[a.symbol].touches = touches[a.symbol]; per[a.symbol].netPct = Math.round(net[a.symbol] * 10) / 10; per[a.symbol].meanFinal = Math.round(finalSum[a.symbol] / runs); }
  return { runs, steps, exhaustedRuns: exhausted, exhaustedPct: Math.round((exhausted / runs) * 1000) / 10, meanStepsDone: Math.round((doneSum / runs) * 10) / 10, firstExhaustionStep: firstEx, perAsset: per };
}
