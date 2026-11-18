"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScaledStage } from "@/components/display/scaled-stage";
import { fetchMarketBoard, type MarketBoardData } from "@/lib/display/data";
import { appendSample, chartGeometry, parseSamples, type IkcSample } from "@/lib/display/ikc";
import type { Mover } from "@/lib/display/view";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatNumber, formatPercent, formatRupiah, formatTimeSecondsWib, formatTimeWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 5_000;
const STORAGE_KEY = "classmeet:display:ikc:v1";
const CHART_W = 1120; // 1184 (lebar kartu dalam) − sumbu Y 52 − jarak 12
const CHART_H = 360;

const ikcFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ikc = (n: number) => ikcFormat.format(n);

const STATE_PILL: Record<MarketBoardData["game"]["state"], { text: string; tone: "ok" | "warn" }> = {
  open: { text: "PASAR BUKA", tone: "ok" },
  paused: { text: "PASAR DIJEDA", tone: "warn" },
  setup: { text: "PASAR BELUM DIBUKA", tone: "warn" },
  finished: { text: "PERMAINAN SELESAI", tone: "warn" },
};

/**
 * Layar publik "Display pasar" (Figma `Layar publik — Display pasar`, 1123:612; docs/12 §9, docs/07 §2.4):
 * IKC dengan grafik garis, indeks sektor, terbaik/terlemah, berita terbaru, dan transaksi terakhir. Hanya baca,
 * tanpa interaksi, tanpa saldo tim dan tanpa order book. Data diambil ulang tiap 5 dtk.
 * Grafik IKC dicuplik oleh layar ini sendiri dan disimpan di perangkatnya (lihat lib/display/ikc.ts).
 */
export function MarketScreen({ initial, live = true }: { initial: MarketBoardData | null; live?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<MarketBoardData | null>(initial);
  const [offline, setOffline] = useState(false);
  const [samples, setSamples] = useState<IkcSample[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const samplesRef = useRef<IkcSample[]>([]);
  const mounted = useRef(true);

  const record = useCallback((value: number | null) => {
    if (value === null) return;
    const next = appendSample(samplesRef.current, Date.now(), value);
    if (
      next.length === samplesRef.current.length &&
      next[next.length - 1] === samplesRef.current[next.length - 1]
    )
      return;
    samplesRef.current = next;
    setSamples(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // penyimpanan penuh/diblokir: grafik tetap jalan di memori
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!live) return;
    const next = await fetchMarketBoard(supabase);
    if (!mounted.current) return;
    if (next) {
      setData(next);
      record(next.index.ikc);
    }
    setOffline(next === null);
  }, [supabase, live, record]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    mounted.current = true;
    // Muat cuplikan tersimpan, lalu catat nilai awal dari server; jam dihitung di browser (bukan saat render).
    const id = window.setTimeout(() => {
      try {
        samplesRef.current = parseSamples(window.localStorage.getItem(STORAGE_KEY));
        setSamples(samplesRef.current);
      } catch {
        // diabaikan
      }
      record(initial?.index.ikc ?? null);
      setNow(Date.now());
    }, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      mounted.current = false;
      window.clearTimeout(id);
      window.clearInterval(clock);
    };
  }, [initial, record]);

  const geometry = useMemo(() => chartGeometry(samples, CHART_W, CHART_H), [samples]);
  // Rentang pendek (< 5 menit) diberi detik supaya label sumbu X tidak berulang.
  const spanMs = samples.length > 1 ? samples[samples.length - 1][0] - samples[0][0] : 0;
  const axisTime = spanMs < 5 * 60_000 ? formatTimeSecondsWib : formatTimeWib;
  const value = data?.index.ikc ?? null;
  const pct = value === null ? null : (value - 1000) / 10;
  const diff = value === null ? null : value - 1000;
  const pill = data ? STATE_PILL[data.game.state] : null;

  return (
    <ScaledStage>
      <div className="flex h-full flex-col gap-5 p-10">
        {/* Bilah atas */}
        <header className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-ink-on-accent grid size-10 place-items-center rounded-full text-[20px] font-bold">
              C
            </div>
            <p className="text-ink text-[24px] font-bold">CLASSMEET MARKET</p>
          </div>
          <div className="flex-1" />
          {offline ? (
            <span role="status" className="text-bad-text text-[18px] font-semibold">
              Terputus, mencoba menyambung kembali…
            </span>
          ) : null}
          {pill ? (
            <span
              className={cn(
                "border-line bg-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-bold tracking-[0.06em]",
                pill.tone === "ok" ? "text-ok-text" : "text-accent-text",
              )}
            >
              <span
                aria-hidden
                className={cn("size-3 rounded-full", pill.tone === "ok" ? "bg-ok-text" : "bg-accent")}
              />
              {pill.text}
            </span>
          ) : null}
          <p className="tnum text-ink text-[28px] font-bold">{now ? formatTimeWib(now) : ""}</p>
        </header>

        {data === null ? (
          <p className="text-ink-muted mt-32 text-center text-[40px] font-medium">Memuat data pasar…</p>
        ) : (
          <>
            <div className="flex shrink-0 items-start gap-5">
              {/* Indeks gabungan */}
              <section
                aria-label="Indeks gabungan"
                className="border-line bg-card rounded-panel flex w-[1240px] shrink-0 flex-col gap-[18px] self-stretch border p-7"
              >
                <div className="flex items-center gap-5">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                      IKC · Indeks Classmeet ({data.assetCount} aset, basis 1.000)
                    </p>
                    <div className="flex items-center gap-4">
                      <p className="tnum text-ink text-[64px] leading-tight font-bold">
                        {value === null ? "–" : ikc(value)}
                      </p>
                      {pct !== null && diff !== null ? (
                        <Change pct={pct} extra={ikc(Math.abs(diff))} big />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <p className="bg-field text-ink-muted rounded-row px-4 py-2 text-[15px] font-semibold">
                    {samples.length > 1
                      ? `Grafik sejak ${formatTimeWib(samples[0][0])}`
                      : "Grafik terbentuk setelah layar berjalan"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="text-ink-muted relative h-[360px] w-[52px] shrink-0 text-right text-[13px]">
                    {geometry.yTicks.map((t) => (
                      <span
                        key={t.value}
                        className="tnum absolute right-0 -translate-y-1/2"
                        style={{ top: t.y }}
                      >
                        {formatNumber(Math.round(t.value))}
                      </span>
                    ))}
                  </div>
                  <svg
                    role="img"
                    aria-label={value === null ? "Grafik IKC" : `Grafik IKC, sekarang ${ikc(value)}`}
                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                    className="h-[360px] w-[1120px] shrink-0"
                  >
                    <defs>
                      <linearGradient id="ikc-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {geometry.yTicks.map((t) => (
                      <line
                        key={t.value}
                        x1="0"
                        x2={CHART_W}
                        y1={t.y}
                        y2={t.y}
                        stroke="var(--border)"
                        strokeDasharray="4 6"
                      />
                    ))}
                    {geometry.baselineY !== null ? (
                      <line
                        x1="0"
                        x2={CHART_W}
                        y1={geometry.baselineY}
                        y2={geometry.baselineY}
                        stroke="var(--border-strong)"
                        strokeWidth="1.5"
                      />
                    ) : null}
                    {geometry.area ? <path d={geometry.area} fill="url(#ikc-fill)" /> : null}
                    {geometry.line ? (
                      <path
                        d={geometry.line}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : (
                      <text
                        x={CHART_W / 2}
                        y={CHART_H / 2}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize="22"
                      >
                        Grafik terbentuk beberapa saat setelah layar menyala
                      </text>
                    )}
                  </svg>
                </div>
                <div className="text-ink-muted flex justify-between pl-16 text-[13px]">
                  {geometry.xTicks.length > 0 && samples.length > 1
                    ? geometry.xTicks.map((t) => (
                        <span key={t.ts} className="tnum">
                          {axisTime(t.ts)}
                        </span>
                      ))
                    : null}
                </div>

                <div className="flex gap-3">
                  {data.index.sectors.map((s) => (
                    <div
                      key={s.name}
                      className="bg-field rounded-row flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5"
                    >
                      <p className="text-ink-muted text-[12px] leading-tight font-semibold tracking-[0.08em] [overflow-wrap:anywhere] uppercase">
                        {s.name}
                      </p>
                      <p className="tnum text-ink text-[24px] font-bold">{ikc(s.value)}</p>
                      <Change pct={s.pct} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Kolom kanan */}
              <div className="flex min-w-0 flex-1 flex-col gap-5">
                <Movers title="Terbaik" movers={data.best} empty="Belum ada yang naik." />
                <Movers title="Terlemah" movers={data.worst} empty="Belum ada yang turun." />
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-5 leading-normal">
              <section
                aria-label="Berita terbaru"
                className="border-line bg-card rounded-panel flex w-[1240px] shrink-0 flex-col gap-1.5 border p-5"
              >
                <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                  Berita terbaru
                </p>
                {data.news ? (
                  <>
                    <p className="text-ink truncate text-[26px] font-bold">{data.news.title}</p>
                    <p className="text-ink-muted line-clamp-2 text-[16px]">{data.news.body}</p>
                  </>
                ) : (
                  <p className="text-ink-muted text-[22px] font-medium">Belum ada berita.</p>
                )}
              </section>
              <section
                aria-label="Transaksi terakhir"
                className="border-line bg-card rounded-panel flex min-w-0 flex-1 flex-col gap-2 border p-5"
              >
                <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                  Transaksi terakhir
                </p>
                {data.lastTrades.length === 0 ? (
                  <p className="text-ink-muted text-[18px] font-medium">Belum ada transaksi.</p>
                ) : (
                  data.lastTrades.map((t) => (
                    <div key={t.symbol} className="flex items-center gap-3">
                      <p className="text-brand-text w-14 shrink-0 text-[16px] font-bold">{t.symbol}</p>
                      <p className="tnum text-ink min-w-0 flex-1 truncate text-[16px] font-semibold">
                        @ {formatNumber(t.price)}
                      </p>
                      <p className="tnum text-ink-muted shrink-0 text-[14px]">{formatTimeWib(t.at)}</p>
                    </div>
                  ))
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </ScaledStage>
  );
}

/** Chip perubahan: ▲/▼ + tanda + persen (bukan hanya warna). */
function Change({ pct, extra, big }: { pct: number; extra?: string; big?: boolean }) {
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={cn(
        "tnum inline-flex w-fit items-center rounded-full font-bold",
        big ? "px-3 py-1 text-[18px]" : "px-3 py-1 text-[13px]",
        up ? "bg-ok/16 text-ok-text" : down ? "bg-bad/16 text-bad-text" : "bg-soft text-ink-muted",
      )}
    >
      {up ? "▲ " : down ? "▼ " : ""}
      {formatPercent(pct)}
      {extra ? ` · ${up ? "+" : down ? "−" : ""}${extra}` : ""}
    </span>
  );
}

function Movers({ title, movers, empty }: { title: string; movers: Mover[]; empty: string }) {
  return (
    <section
      aria-label={title}
      className="border-line bg-card rounded-panel flex flex-col gap-2.5 border px-6 py-5"
    >
      <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">{title}</p>
      {movers.length === 0 ? (
        <p className="text-ink-muted py-4 text-[20px] font-medium">{empty}</p>
      ) : (
        movers.map((m) => (
          <div key={m.symbol} className="bg-field rounded-row flex items-center gap-3.5 px-3 py-2">
            <span className="rounded-control bg-primary text-on-primary grid h-11 w-[52px] shrink-0 place-items-center text-[15px] font-bold">
              {m.symbol}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-[20px] leading-tight font-bold">{m.name}</p>
              <p className="tnum text-ink-muted text-[15px]">{formatRupiah(m.price)}</p>
            </div>
            <Change pct={m.pct} big />
          </div>
        ))
      )}
    </section>
  );
}
