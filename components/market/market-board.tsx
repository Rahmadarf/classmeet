"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetDetail } from "@/components/market/asset-detail";
import { AnalysisCard } from "@/components/market/analysis-card";
import { AssetList } from "@/components/market/asset-list";
import { BankruptNotice } from "@/components/market/bankrupt-notice";
import { MarketStateBanner } from "@/components/market/market-state-banner";
import { NewsStrip } from "@/components/market/news-strip";
import { SuspendNotice } from "@/components/market/suspend-notice";
import { TradePanel } from "@/components/market/trade-panel";
import { ErrorState } from "@/components/states";
import { isSuspended } from "@/lib/market/data";
import type { MarketSnapshot } from "@/lib/market/snapshot";
import { qk } from "@/lib/query/keys";
import { pollOptions, seed, seedMaybe } from "@/lib/query/options";
import {
  invalidateAfterTrade,
  invalidateMarket,
  marketSnapshotQuery,
  newsQuery,
  summaryQuery,
} from "@/lib/query/queries";
import { useRealtime } from "@/lib/query/use-realtime";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { NewsItem, Summary } from "@/lib/team/data";

type NewsFeedRow = Database["public"]["Tables"]["news_feed"]["Row"];

/** Harga, stok, status pasar, dan kepemilikan: polling 5 dtk (docs/17; BUKAN postgres_changes pada `assets`). */
const FAST_POLL_MS = 5_000;
/** Saldo: `get_my_summary()` tiap ±10 dtk (docs/07 §5) dan segera setelah ada transaksi. */
const CASH_POLL_MS = 10_000;
const NEWS_POLL_MS = 30_000;

export type MarketInitial = {
  /** Game, aset, kepemilikan, bangkrut, dan tawaran analisa (satu pengambilan; null analisa bila gagal dimuat). */
  snapshot: MarketSnapshot;
  /** Ringkasan uang tim (saldo dipakai papan ini; kunci cache dibagi dengan Beranda dan Portofolio). */
  summary: Summary | null;
  latestNews: NewsItem | null;
  selectedId: string;
  /** Tab awal panel (tautan dari Portofolio membuka tab Jual). */
  initialSide: "buy" | "sell";
  /** Jam server (ms) saat halaman dibuat; sesudahnya jam peramban. */
  nowMs: number;
};

/**
 * Papan Pasar yang hidup (model toko, docs/17; docs/07 §3.1–3.2). Data awal dari server (jadi `initialData`);
 * sesudahnya TanStack Query: polling 5 dtk, ambil ulang saat tab aktif lagi / koneksi kembali, dan Realtime hanya
 * sebagai pemberitahuan (`game_settings` berubah, `news_feed` baru) yang menandai query kedaluwarsa.
 * Kebenaran harga dan stok selalu dari `get_market_summary`.
 */
export function MarketBoard({ initial }: { initial: MarketInitial }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [now, setNow] = useState(initial.nowMs);
  const [selectedId, setSelectedId] = useState(initial.selectedId);

  // Satu query untuk game, aset, kepemilikan, bangkrut, dan tawaran analisa (satu panggilan, satu snapshot database).
  const snapQ = useQuery({
    ...marketSnapshotQuery(supabase),
    ...pollOptions(FAST_POLL_MS),
    ...seed(initial.snapshot),
  });
  const { game, market, holdings, bankrupt, analysis } = snapQ.data;
  const summaryQ = useQuery({
    ...summaryQuery(supabase),
    ...pollOptions(CASH_POLL_MS),
    ...seedMaybe(initial.summary),
  });
  const newsQ = useQuery({
    ...newsQuery(supabase, 1),
    ...pollOptions(NEWS_POLL_MS),
    ...seedMaybe(initial.latestNews ? [initial.latestNews] : null),
  });

  const cash = summaryQ.data?.cash ?? null;
  const latestNews = newsQ.data?.[0] ?? null;
  // Pengambilan yang gagal (data lama tetap tampil): pengganti penanda `stale` lama.
  const stale = snapQ.isError;

  // Jam untuk hitung mundur suspensi (tiap detik).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Realtime: hanya pemberitahuan. `game_settings` (jeda/buka/tutup) dan `news_feed` boleh (RLS terbuka, tabel kecil).
  useRealtime("market-board", [
    {
      event: "UPDATE",
      table: "game_settings",
      onEvent: () => void invalidateMarket(queryClient),
    },
    {
      event: "INSERT",
      table: "news_feed",
      onEvent: (payload) => {
        const row = payload.new as NewsFeedRow;
        queryClient.setQueryData(qk.news(1), [
          { id: row.news_id, title: row.title, body: row.body, publishedAt: row.published_at },
        ]);
        toast(`Berita baru: ${row.title}`);
        void invalidateMarket(queryClient); // berita baru tayang: tawaran analisa berubah
      },
    },
  ]);

  const onChanged = useCallback(() => void invalidateAfterTrade(queryClient), [queryClient]);

  // Aset yang dilihat hilang dari daftar (bangkrut): pindah ke aset pertama.
  const selected = market.find((a) => a.id === selectedId) ?? market[0];
  const effectiveId = selected?.id;

  const select = useCallback(
    (id: string) => {
      if (id === effectiveId) return;
      setSelectedId(id);
      // Ponsel/tablet: detail dan panel ada di bawah daftar; bawa ke sana supaya pilihan langsung terlihat.
      if (window.matchMedia("(max-width: 1279px)").matches) {
        window.requestAnimationFrame(() =>
          document.getElementById("detail-aset")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    },
    [effectiveId],
  );

  if (!selected) {
    return (
      <ErrorState
        title="Data pasar belum bisa dimuat"
        message="Muat ulang halaman ini."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <NewsStrip latest={latestNews} />
        <MarketStateBanner state={game.state} />
        <BankruptNotice assets={bankrupt} />
        <SuspendNotice assets={market} now={now} />
        {stale ? (
          <p role="status" className="text-ink-muted text-sm">
            Data belum bisa diperbarui, mencoba lagi…
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[272px_minmax(0,1fr)_312px] xl:items-start">
        <AssetList assets={market} selectedId={selected.id} onSelect={select} now={now} />

        <div id="detail-aset" className="flex min-w-0 scroll-mt-4 flex-col gap-4">
          <AssetDetail asset={selected} game={game} holding={holdings[selected.id]} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {analysis ? <AnalysisCard offer={analysis} cash={cash} onChanged={onChanged} /> : null}
          <TradePanel
            key={selected.id}
            initialSide={selected.id === initial.selectedId ? initial.initialSide : "buy"}
            asset={selected}
            game={game}
            cash={cash}
            holding={holdings[selected.id]}
            suspended={isSuspended(selected, now)}
            onChanged={onChanged}
          />
        </div>
      </div>
    </div>
  );
}
