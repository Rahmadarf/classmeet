/**
 * Seri waktu IKC untuk grafik di layar Display pasar.
 *
 * Skema tidak menyimpan riwayat IKC (IKC memakai harga transaksi terakhir; `price_history` hanya mencatat
 * perubahan harga acuan oleh berita, dan `trades` tidak terbaca akun display). Maka layar itu sendiri mencuplik
 * nilai IKC dari `get_market_index()` dan menyimpannya di perangkatnya (localStorage). Grafik mulai dari saat
 * layar pertama menyala dan bertahan saat dimuat ulang. Lihat docs/13 (Tahap B) untuk usulan riwayat di server.
 */
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

export type ChartGeometry = {
  /** Garis (path SVG) dan area di bawahnya; kosong bila titik < 2. */
  line: string;
  area: string;
  /** Label sumbu Y (nilai + posisi y dalam piksel viewBox). */
  yTicks: { value: number; y: number }[];
  /** Posisi y garis dasar 1.000 bila berada dalam rentang, selain itu null. */
  baselineY: number | null;
  /** Label sumbu X (waktu + posisi x). */
  xTicks: { ts: number; x: number }[];
};

/** Hitung geometri grafik dalam ruang `width × height` (piksel viewBox). */
export function chartGeometry(
  samples: readonly IkcSample[],
  width: number,
  height: number,
  opts: { base?: number; yTickCount?: number; xTickCount?: number } = {},
): ChartGeometry {
  const { base = 1000, yTickCount = 4, xTickCount = 5 } = opts;
  if (samples.length === 0) return { line: "", area: "", yTicks: [], baselineY: null, xTicks: [] };

  const values = samples.map(([, v]) => v);
  const rawLo = Math.min(...values, base);
  const rawHi = Math.max(...values, base);
  const span = Math.max(rawHi - rawLo, 4);
  const step = niceStep(span * 1.2, yTickCount);
  const lo = Math.floor((rawLo - span * 0.1) / step) * step;
  const hi = Math.ceil((rawHi + span * 0.1) / step) * step;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

  const t0 = samples[0][0];
  const t1 = samples[samples.length - 1][0];
  const x = (t: number) => (t1 === t0 ? width / 2 : ((t - t0) / (t1 - t0)) * width);

  const pts = samples.map(([t, v]) => [x(t), y(v)] as const);
  const line =
    pts.length < 2
      ? ""
      : pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = line
    ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`
    : "";

  const yTicks: { value: number; y: number }[] = [];
  for (let v = hi; v >= lo - 1e-9; v -= step) yTicks.push({ value: Math.round(v * 100) / 100, y: y(v) });

  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const ts = t0 + ((t1 - t0) * i) / Math.max(xTickCount - 1, 1);
    return { ts, x: x(ts) };
  });

  return { line, area, yTicks, baselineY: base >= lo && base <= hi ? y(base) : null, xTicks };
}
