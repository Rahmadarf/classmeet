/**
 * Seri waktu IHAI untuk grafik di layar Display pasar.
 *
 * Riwayat utama ada di SERVER (`index_history`, dicatat pg_cron tiap 30 detik bila IHAI berubah; dibaca lewat
 * `get_index_history()`), jadi grafik lengkap sejak game dimulai di perangkat mana pun. Layar tetap mencuplik nilai IHAI
 * sendiri tiap 5 detik (localStorage) untuk bagian paling baru di antara dua catatan server dan sebagai cadangan bila
 * riwayat server belum ada (SQL belum dijalankan); `mergeSeries` menyambung keduanya.
 */
import { dayKeyWib } from "@/lib/money";

export type IkcSample = readonly [timestampMs: number, value: number];

export const SAMPLE_GAP_MS = 15_000; // jarak minimum antar cuplikan tersimpan
export const MAX_AGE_MS = 8 * 60 * 60 * 1000; // simpan paling lama 8 jam
export const MAX_POINTS = 2_000;

/** Tambah satu cuplikan: abaikan yang terlalu rapat, buang yang terlalu tua, dan batasi jumlah titik. */
export function appendSample(
  samples: readonly IkcSample[],
  ts: number,
  value: number,
  opts: { gapMs?: number; maxAgeMs?: number; maxPoints?: number } = {},
): IkcSample[] {
  const { gapMs = SAMPLE_GAP_MS, maxAgeMs = MAX_AGE_MS, maxPoints = MAX_POINTS } = opts;
  if (!Number.isFinite(value) || !Number.isFinite(ts)) return [...samples];
  const fresh = samples.filter(([t]) => ts - t <= maxAgeMs && t <= ts);
  const last = fresh[fresh.length - 1];
  if (last && ts - last[0] < gapMs) return fresh;
  const next: IkcSample[] = [...fresh, [ts, value]];
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
}

/** Sambung riwayat server dengan cuplikan lokal yang lebih baru; tanpa riwayat server, cuplikan lokal dipakai apa adanya. */
export function mergeSeries(server: readonly IkcSample[], local: readonly IkcSample[]): IkcSample[] {
  if (server.length === 0) return [...local];
  const lastT = server[server.length - 1][0];
  return [...server, ...local.filter(([t]) => t > lastT + SAMPLE_GAP_MS)];
}

/**
 * Bagian seri yang jatuh pada hari WIB `nowMs`. Grafik menampilkan hari ini supaya pergerakannya terlihat (riwayat dua-tiga hari
 * membuat satu hari terlihat rata); bila baru ada kurang dari 2 titik hari ini, seluruh seri dipakai.
 */
export function todaySeries(series: readonly IkcSample[], nowMs: number): IkcSample[] {
  const key = dayKeyWib(nowMs);
  const today = series.filter(([t]) => dayKeyWib(t) === key);
  return today.length >= 2 ? today : [...series];
}

/** Baca hasil JSON dari penyimpanan; tahan terhadap data rusak. */
export function parseSamples(raw: string | null): IkcSample[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
      )
      .map((p): IkcSample => [p[0], p[1]])
      .sort((a, b) => a[0] - b[0]);
  } catch {
    return [];
  }
}

/** Langkah sumbu yang "bulat": 1, 2, 5 × 10^n. */
function niceStep(range: number, ticks: number): number {
  const raw = range / Math.max(ticks, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

export type ValueDomain = {
  lo: number;
  hi: number;
  /** Nilai tick sumbu Y, dari kecil ke besar. */
  ticks: number[];
  /** True bila garis dasar (bawaan 1.000) berada dalam rentang. */
  baselineInside: boolean;
};

/**
 * Rentang sumbu Y yang mengikuti DATA (bukan dipaksa memuat garis dasar 1.000): perubahan beberapa poin di sekitar 1.087 tetap
 * terlihat. Rentang minimum 4 poin; ada ruang kosong 10 % di atas dan bawah; batas dan tick memakai langkah "bulat".
 */
export function valueDomain(
  values: readonly number[],
  opts: { base?: number; tickCount?: number } = {},
): ValueDomain {
  const { base = 1000, tickCount = 6 } = opts;
  if (values.length === 0)
    return { lo: base - 10, hi: base + 10, ticks: [base - 10, base, base + 10], baselineInside: true };
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);
  const span = Math.max(rawHi - rawLo, 4);
  const mid = (rawLo + rawHi) / 2; // data rata: dipusatkan dalam rentang minimum
  const step = niceStep(span * 1.2, tickCount);
  const lo = Math.floor((mid - span / 2 - span * 0.1) / step) * step;
  const hi = Math.ceil((mid + span / 2 + span * 0.1) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks, baselineInside: base >= lo && base <= hi };
}
