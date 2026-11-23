"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchAnalysisOffer } from "@/lib/analysis/data";
import type { AnalysisOffer } from "@/lib/analysis/view";
import { usePolling } from "@/lib/hooks/use-polling";
import {
  fetchBankruptAssets,
  fetchGame,
  fetchHoldings,
  fetchMarket,
  isSuspended,
  type BankruptAsset,
  type Game,
  type Holding,
  type MarketAsset,
} from "@/lib/market/data";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { fetchNews, fetchSummary, type NewsItem } from "@/lib/team/data";

type NewsFeedRow = Database["public"]["Tables"]["news_feed"]["Row"];

/** Harga, stok, status pasar, dan kepemilikan: polling 5 dtk (docs/17; BUKAN postgres_changes pada `assets`). */
const FAST_POLL_MS = 5_000;
/** Saldo: `get_my_summary()` tiap ±10 dtk (docs/07 §5) dan segera setelah ada transaksi. */
const CASH_POLL_MS = 10_000;

export type MarketInitial = {
  market: MarketAsset[];
  game: Game;
  cash: number | null;
  holdings: Record<string, Holding>;
  latestNews: NewsItem | null;
  selectedId: string;
  /** Tab awal panel (tautan dari Portofolio membuka tab Jual). */
  initialSide: "buy" | "sell";
  bankrupt: BankruptAsset[];
  /** Tawaran Analisa Pasar (pay to win); null bila gagal dimuat. */
  analysis: AnalysisOffer | null;
  /** Jam server (ms) saat halaman dibuat; sesudahnya jam peramban. */
  nowMs: number;
};

/**
 * Papan Pasar yang hidup (model toko, docs/17; docs/07 §3.1–3.2). Data awal dari server; sesudahnya polling 5 dtk,
 * ambil ulang saat tab aktif lagi / koneksi kembali, dan Realtime hanya sebagai pemberitahuan
 * (`game_settings` berubah, `news_feed` baru). Kebenaran harga dan stok selalu dari `get_market_summary`.
 */
export function MarketBoard({ initial }: { initial: MarketInitial }) {
  const supabase = useMemo(() => createClient(), []);
  const [market, setMarket] = useState(initial.market);
  const [game, setGame] = useState(initial.game);
  const [cash, setCash] = useState(initial.cash);
  const [holdings, setHoldings] = useState(initial.holdings);
  const [latestNews, setLatestNews] = useState(initial.latestNews);
  const [bankrupt, setBankrupt] = useState(initial.bankrupt);
  const [analysis, setAnalysis] = useState(initial.analysis);
  const [now, setNow] = useState(initial.nowMs);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [stale, setStale] = useState(false);
  const selectedRef = useRef(initial.selectedId);
  const dropped = useRef(false);
  const spreadRef = useRef(initial.game.sellSpreadBps);

  const refreshFast = useCallback(async () => {
    const g = await fetchGame(supabase);
    if (g) spreadRef.current = g.sellSpreadBps;
    const [m, h, bk, an] = await Promise.all([
      fetchMarket(supabase, spreadRef.current),
      fetchHoldings(supabase),
      fetchBankruptAssets(supabase),
      fetchAnalysisOffer(supabase),
    ]);
    if (bk) setBankrupt(bk);
    if (an) setAnalysis(an);
    if (m && m.length > 0) {
      setMarket(m);
      // Aset yang dilihat hilang dari daftar (bangkrut): pindah ke aset pertama.
      if (!m.some((a) => a.id === selectedRef.current)) {
        selectedRef.current = m[0].id;
        setSelectedId(m[0].id);
      }
    }
    if (g) setGame(g);
    if (h) setHoldings(h);
    setStale(!(m && g && h && bk));
  }, [supabase]);

  const refreshCash = useCallback(async () => {
    const s = await fetchSummary(supabase);
    if (s) setCash(s.cash);
  }, [supabase]);

  const refreshNews = useCallback(async () => {
    const items = await fetchNews(supabase, 1);
    if (items) setLatestNews(items[0] ?? null);
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshFast(), refreshCash(), refreshNews()]);
  }, [refreshFast, refreshCash, refreshNews]);

  // Jam untuk hitung mundur suspensi (tiap detik).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  usePolling(refreshFast, FAST_POLL_MS);
  usePolling(refreshCash, CASH_POLL_MS);
  usePolling(refreshNews, 30_000);

  // Realtime: hanya pemberitahuan. `game_settings` (jeda/buka/tutup) dan `news_feed` boleh (RLS terbuka, tabel kecil).
  useEffect(() => {
    const channel = supabase
      .channel("market-board")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_settings" }, () => {
        void refreshFast();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_feed" }, (payload) => {
        const row = payload.new as NewsFeedRow;
        setLatestNews({ id: row.news_id, title: row.title, body: row.body, publishedAt: row.published_at });
        toast(`Berita baru: ${row.title}`);
        void refreshFast(); // berita baru tayang: tawaran analisa berubah
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refreshAll(); // tersambung ulang: jangan percaya Realtime tidak terlewat
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshFast, refreshAll]);

  const select = useCallback((id: string) => {
    if (id === selectedRef.current) return;
    selectedRef.current = id;
    setSelectedId(id);
    // Ponsel/tablet: detail dan panel ada di bawah daftar; bawa ke sana supaya pilihan langsung terlihat.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      window.requestAnimationFrame(() =>
        document.getElementById("detail-aset")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  const selected = market.find((a) => a.id === selectedId) ?? market[0];
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
          {analysis ? (
            <AnalysisCard offer={analysis} cash={cash} onChanged={() => void refreshAll()} />
          ) : null}
          <TradePanel
            key={selected.id}
            initialSide={selected.id === initial.selectedId ? initial.initialSide : "buy"}
            asset={selected}
            game={game}
            cash={cash}
            holding={holdings[selected.id]}
            suspended={isSuspended(selected, now)}
            onChanged={() => void refreshAll()}
          />
        </div>
      </div>
    </div>
  );
}
