"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DisplayHeader } from "@/components/display/display-header";
import { IkcChart } from "@/components/display/ikc-chart";
import { ScaledStage } from "@/components/display/scaled-stage";
import { fetchMarketBoard, type MarketBoardData } from "@/lib/display/data";
import { appendSample, mergeSeries, parseSamples, todaySeries, type IkcSample } from "@/lib/display/ikc";
import type { Mover } from "@/lib/display/view";
import {
  formatDateWib,
  formatNumber,
  formatPercent,
  formatRupiah,
  formatTimeSecondsWib,
  formatTimeWib,
} from "@/lib/money";
import { must, pollOptions, seedMaybe } from "@/lib/query/options";
import { indexHistoryQuery, marketBoardQuery } from "@/lib/query/queries";
import { firstParagraph } from "@/lib/team/news-text";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 5_000;
const STORAGE_KEY = "classmeet:display:ikc:v1";
const CHART_W = 1184; // lebar dalam kartu IHAI
const CHART_H = 400;

const ikcFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ikc = (n: number) => ikcFormat.format(n);

/**
 * Layar publik "Display pasar" (Figma `Layar publik — Display pasar`, 1123:612; docs/12 §9, docs/07 §2.4):
 * IHAI dengan grafik garis, indeks sektor, terbaik/terlemah, berita terbaru, dan transaksi terakhir. Hanya baca,
 * tanpa interaksi, tanpa saldo tim dan tanpa order book. Data diambil ulang tiap 5 dtk.
 * Grafik IHAI dicuplik oleh layar ini sendiri dan disimpan di perangkatnya (lihat lib/display/ikc.ts).
 */
export function MarketScreen({ initial, live = true }: { initial: MarketBoardData | null; live?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [samples, setSamples] = useState<IkcSample[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const samplesRef = useRef<IkcSample[]>([]);

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

  // Setiap pengambilan yang berhasil juga dicatat sebagai cuplikan grafik IHAI (sama seperti polling sebelumnya;
  // dilakukan di dalam queryFn supaya tiap ketukan tercatat walau isinya tidak berubah).
  const marketQ = useQuery({
    ...marketBoardQuery(supabase),
    queryFn: async () => {
      const next = await must(fetchMarketBoard(supabase), "market-board");
      record(next.index.ikc);
      return next;
    },
    ...pollOptions(POLL_MS),
    ...seedMaybe(initial),
    enabled: live,
  });
  const data: MarketBoardData | null = marketQ.data ?? null;
  const offline = marketQ.isError;

  // Riwayat IHAI dari server (seluruh game); kosong bila belum ada / gagal dimuat. Dimuat saat layar menyala
  // lalu disegarkan tiap menit (catatan baru bertambah tiap ±30 detik).
  const historyQ = useQuery({
    ...indexHistoryQuery(supabase),
    ...pollOptions(60_000),
    enabled: live,
  });
  const history: IkcSample[] = useMemo(() => historyQ.data ?? [], [historyQ.data]);

  useEffect(() => {
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
      window.clearTimeout(id);
      window.clearInterval(clock);
    };
  }, [initial, record]);

  // Grafik = hari ini (riwayat server memuat seluruh game; satu hari terlihat rata bila digabung dengan hari lain).
  const full = useMemo(() => mergeSeries(history, samples), [history, samples]);
  const series = useMemo(() => todaySeries(full, now ?? 0), [full, now]);
  // Rentang pendek (< 5 menit) diberi detik supaya label sumbu X tidak berulang.
  const spanMs = series.length > 1 ? series[series.length - 1][0] - series[0][0] : 0;
  // Rentang lebih dari sehari (riwayat server sejak game dimulai): label memuat tanggal supaya jam yang sama tak membingungkan.
  const axisTime =
    spanMs > 20 * 3_600_000
      ? (ts: number) => `${formatDateWib(ts).replace(/ \d{4}$/, "")} ${formatTimeWib(ts)}`
      : spanMs < 5 * 60_000
        ? formatTimeSecondsWib
        : formatTimeWib;
  const value = data?.index.ikc ?? null;
  const pct = value === null ? null : (value - 1000) / 10;
  const diff = value === null ? null : value - 1000;

  return (
    <ScaledStage>
      <div className="flex h-full flex-col gap-5 p-10">
        <DisplayHeader state={data?.game.state ?? null} now={now} offline={offline} />

        {data === null ? (
          <p className="text-ink-muted mt-32 text-center text-[40px] font-medium">Memuat data pasar…</p>
        ) : (
          <>
            <div className="flex shrink-0 items-start gap-5">
              {/* Indeks gabungan */}
              <section
                aria-label="Indeks gabungan"
                className="border-line bg-card shadow-card rounded-panel flex w-[1240px] shrink-0 flex-col gap-[18px] self-stretch border p-7"
              >
                <div className="flex items-center gap-5">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                      IHAI · Indeks Harga Aset ISSC ({data.assetCount} aset, basis 1.000)
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
                    {series.length > 1
                      ? `Grafik ${series.length < full.length ? "hari ini " : ""}sejak ${formatTimeWib(series[0][0])}`
                      : "Grafik terbentuk setelah layar berjalan"}
                  </p>
                </div>

                <IkcChart
                  series={series}
                  width={CHART_W}
                  height={CHART_H}
                  axisTime={axisTime}
                  label={value === null ? "Grafik IHAI" : `Grafik IHAI, sekarang ${ikc(value)}`}
                />

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
                className="border-line bg-card shadow-card rounded-panel flex w-[1240px] shrink-0 flex-col gap-1.5 border p-5"
              >
                <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                  Berita terbaru
                </p>
                {data.news ? (
                  <>
                    <p className="text-ink truncate text-[26px] font-bold">{data.news.title}</p>
                    <p className="text-ink-muted line-clamp-2 text-[16px]">
                      {firstParagraph(data.news.body)}
                    </p>
                  </>
                ) : (
                  <p className="text-ink-muted text-[22px] font-medium">Belum ada berita.</p>
                )}
              </section>
              <section
                aria-label="Transaksi terakhir"
                className="border-line bg-card shadow-card rounded-panel flex min-w-0 flex-1 flex-col gap-2 border p-5"
              >
                <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
                  Transaksi terakhir
                </p>
                {data.lastTrades.length === 0 ? (
                  <p className="text-ink-muted text-[18px] font-medium">Belum ada transaksi.</p>
                ) : (
                  data.lastTrades.map((t) => (
                    <div key={`${t.symbol}-${t.at}`} className="flex items-center gap-3">
                      <p className="text-brand-text w-14 shrink-0 text-[16px] font-bold">{t.symbol}</p>
                      <p className="tnum text-ink min-w-0 flex-1 truncate text-[16px] font-semibold">
                        <span className={t.side === "buy" ? "text-ok-text" : "text-bad-text"}>
                          {t.side === "buy" ? "Beli" : "Jual"}
                        </span>{" "}
                        {formatNumber(t.qty)} unit @ {formatNumber(t.price)}
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
      className="border-line bg-card shadow-card rounded-panel flex flex-col gap-2.5 border px-6 py-5"
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
