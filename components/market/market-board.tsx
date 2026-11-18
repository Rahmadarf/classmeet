"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetDetail } from "@/components/market/asset-detail";
import { AssetList } from "@/components/market/asset-list";
import { BankruptNotice } from "@/components/market/bankrupt-notice";
import { MarketStateBanner } from "@/components/market/market-state-banner";
import { NewsStrip } from "@/components/market/news-strip";
import { OpenOrders } from "@/components/market/open-orders";
import { OrderBook } from "@/components/market/order-book";
import { OrderForm } from "@/components/market/order-form";
import { SuspendNotice } from "@/components/market/suspend-notice";
import { ErrorState } from "@/components/states";
import { useSetOpenOrdersCount } from "@/components/team/open-orders-count";
import { usePolling } from "@/lib/hooks/use-polling";
import {
  fetchBand,
  fetchBankruptAssets,
  fetchGame,
  fetchHoldings,
  fetchMarket,
  fetchOpenOrders,
  fetchOrderBook,
  isSuspended,
  type BankruptAsset,
  type Band,
  type Game,
  type Holding,
  type MarketAsset,
  type OpenOrder,
  type OrderBook as Book,
} from "@/lib/market/data";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { fetchNews, fetchSummary, type NewsItem } from "@/lib/team/data";

type NewsFeedRow = Database["public"]["Tables"]["news_feed"]["Row"];

/** Harga, order book, status pasar, kepemilikan, dan order terbuka: polling 5 dtk (docs/12; BUKAN postgres_changes). */
const FAST_POLL_MS = 5_000;
/** Saldo: `get_my_summary()` tiap ±10 dtk (docs/07 §5) dan segera setelah ada aksi. */
const CASH_POLL_MS = 10_000;

export type MarketInitial = {
  market: MarketAsset[];
  game: Game;
  cash: number | null;
  holdings: Record<string, Holding>;
  orders: OpenOrder[];
  latestNews: NewsItem | null;
  selectedId: string;
  /** Tab awal form order (tautan dari Portofolio membuka tab Jual). */
  initialSide: "buy" | "sell";
  book: Book | null;
  band: Band | null;
  bankrupt: BankruptAsset[];
  /** Jam server (ms) saat halaman dibuat; sesudahnya jam peramban. */
  nowMs: number;
};

type BookState = { assetId: string; book: Book | null; band: Band | null };

/**
 * Papan Pasar yang hidup (docs/07 §3.1–3.2, docs/12 §9). Data awal dari server; sesudahnya polling 5 dtk,
 * ambil ulang saat tab aktif lagi / koneksi kembali, dan Realtime hanya sebagai pemberitahuan
 * (`game_settings` berubah, `news_feed` baru). Order book dan harga TIDAK memakai Realtime di tabel
 * `orders`/`trades`/`assets`: kebenaran selalu dari `get_order_book` dan `get_market_summary`.
 */
export function MarketBoard({ initial }: { initial: MarketInitial }) {
  const supabase = useMemo(() => createClient(), []);
  const [market, setMarket] = useState(initial.market);
  const [game, setGame] = useState(initial.game);
  const [cash, setCash] = useState(initial.cash);
  const [holdings, setHoldings] = useState(initial.holdings);
  const [orders, setOrders] = useState(initial.orders);
  const [latestNews, setLatestNews] = useState(initial.latestNews);
  const [bankrupt, setBankrupt] = useState(initial.bankrupt);
  const [now, setNow] = useState(initial.nowMs);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [bookState, setBookState] = useState<BookState>({
    assetId: initial.selectedId,
    book: initial.book,
    band: initial.band,
  });
  const [stale, setStale] = useState(false);
  const setOpenCount = useSetOpenOrdersCount();
  const selectedRef = useRef(initial.selectedId);
  const dropped = useRef(false);

  const refreshFast = useCallback(async () => {
    const id = selectedRef.current;
    const [m, g, h, o, book, band, bk] = await Promise.all([
      fetchMarket(supabase),
      fetchGame(supabase),
      fetchHoldings(supabase),
      fetchOpenOrders(supabase),
      fetchOrderBook(supabase, id),
      fetchBand(supabase, id),
      fetchBankruptAssets(supabase),
    ]);
    if (bk) setBankrupt(bk);
    if (m && m.length > 0) {
      setMarket(m);
      // Aset yang dilihat hilang dari daftar (bangkrut): pindah ke aset pertama, jangan terus meminta antreannya.
      if (!m.some((a) => a.id === selectedRef.current)) {
        selectedRef.current = m[0].id;
        setSelectedId(m[0].id);
        setBookState({ assetId: m[0].id, book: null, band: null });
      }
    }
    if (g) setGame(g);
    if (h) setHoldings(h);
    if (o) setOrders(o);
    // Hanya terapkan bila aset yang dilihat belum berganti selagi permintaan berjalan.
    if (id === selectedRef.current) {
      setBookState((prev) => ({
        assetId: id,
        book: book ?? (prev.assetId === id ? prev.book : null),
        band: band ?? (prev.assetId === id ? prev.band : null),
      }));
    }
    setStale(!(m && g && h && o && bk && ((book && band) || id !== selectedRef.current)));
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

  // Lencana sidebar mengikuti daftar order antre yang terlihat di halaman ini.
  useEffect(() => {
    setOpenCount(orders.length);
  }, [orders.length, setOpenCount]);

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

  const select = useCallback(
    (id: string) => {
      if (id === selectedRef.current) return;
      selectedRef.current = id;
      setSelectedId(id);
      setBookState({ assetId: id, book: null, band: null }); // jangan tampilkan antrean aset sebelumnya
      void refreshFast();
    },
    [refreshFast],
  );

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
  const current =
    bookState.assetId === selected.id ? bookState : { assetId: selected.id, book: null, band: null };

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

        <div className="flex min-w-0 flex-col gap-4">
          <AssetDetail asset={selected} band={current.band} />
          <OrderBook book={current.book} lastPrice={selected.lastPrice} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <OrderForm
            key={selected.id}
            initialSide={selected.id === initial.selectedId ? initial.initialSide : "buy"}
            asset={selected}
            band={current.band}
            game={game}
            cash={cash}
            holding={holdings[selected.id]}
            book={current.book}
            suspended={isSuspended(selected, now)}
            onChanged={() => void refreshAll()}
          />
          <OpenOrders
            orders={orders}
            assets={market}
            canCancel={game.state === "open"}
            onChanged={() => void refreshAll()}
          />
        </div>
      </div>
    </div>
  );
}
