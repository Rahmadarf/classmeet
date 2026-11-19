"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { valueDomain, type IkcSample } from "@/lib/display/ikc";
import { formatNumber } from "@/lib/money";

/**
 * Grafik IKC memakai Recharts (menggantikan SVG buatan sendiri). Ukuran tetap (panggung 1920×1080 sudah diskalakan oleh
 * `ScaledStage`), garis berundak (`stepAfter`: IKC berubah mendadak saat berita berlaku lalu tetap), tanpa animasi dan tanpa tooltip (layar publik tanpa interaksi). Sumbu Y mengikuti data (`valueDomain`);
 * garis dasar 1.000 hanya digambar bila berada dalam rentang. Warna memakai token yang sama dengan sebelumnya.
 */
export function IkcChart({
  series,
  width,
  height,
  axisTime,
  label,
}: {
  series: readonly IkcSample[];
  width: number;
  height: number;
  axisTime: (ts: number) => string;
  label: string;
}) {
  if (series.length < 2) {
    return (
      <div
        role="img"
        aria-label={label}
        className="text-ink-muted grid place-items-center text-[22px]"
        style={{ width, height }}
      >
        Grafik terbentuk beberapa saat setelah layar menyala
      </div>
    );
  }
  const data = series.map(([t, v]) => ({ t, v }));
  const domain = valueDomain(series.map(([, v]) => v));
  // Lima label waktu berjarak sama (Recharts tidak menjarangkan sendiri pada sumbu waktu).
  const t0 = series[0][0];
  const t1 = series[series.length - 1][0];
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round(t0 + ((t1 - t0) * i) / 4));
  return (
    <div role="img" aria-label={label} style={{ width, height }}>
      <AreaChart
        width={width}
        height={height}
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <defs>
          <linearGradient id="ikc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={xTicks}
          tickFormatter={(t: number) => axisTime(t)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--text-muted)", fontSize: 13 }}
          padding={{ left: 0, right: 0 }}
        />
        <YAxis
          type="number"
          domain={[domain.lo, domain.hi]}
          ticks={domain.ticks}
          tickFormatter={(v: number) => formatNumber(Math.round(v))}
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fill: "var(--text-muted)", fontSize: 13 }}
        />
        {domain.baselineInside ? (
          <ReferenceLine y={1000} stroke="var(--border-strong)" strokeWidth={1.5} />
        ) : null}
        <Area
          type="stepAfter"
          dataKey="v"
          stroke="var(--primary)"
          strokeWidth={3}
          fill="url(#ikc-fill)"
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </div>
  );
}
