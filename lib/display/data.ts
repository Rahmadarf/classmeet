import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGame, type Game } from "@/lib/market/data";
import type { IkcSample } from "./ikc";
import type { Database } from "@/lib/supabase/database.types";
import { isMoney } from "@/lib/money";
import { fetchNews, type NewsItem } from "@/lib/team/data";
import {
  mapLastTrades,
  movers,
  parseIndex,
  topFive,
  type IndexSnapshot,
  type LastTrade,
  type LeaderRow,
  type Mover,
} from "./view";

type Db = SupabaseClient<Database>;

export type LeaderboardResult = { hidden: true } | { hidden: false; rows: LeaderRow[] };

/**
 * `get_leaderboard()` untuk akun display. Dibekukan → server mengembalikan snapshot (layar tidak memberi tanda
 * apa pun). Disembunyikan → error `leaderboard_hidden` → layar tunggu. Gagal lain → null (data lama dipertahankan).
 */
export async function fetchLeaderboard(supabase: Db): Promise<LeaderboardResult | null> {
  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) return error.message.includes("leaderboard_hidden") ? { hidden: true } : null;
  if (!data) return null;
  return { hidden: false, rows: topFive(data) };
}

/** Riwayat IKC dari server (`get_index_history`), terlama dulu; null bila gagal (layar memakai cuplikan lokalnya). */
export async function fetchIndexHistory(supabase: Db): Promise<IkcSample[] | null> {
  const { data, error } = await supabase.rpc("get_index_history");
  if (error || !data) return null;
  return data.flatMap((r): IkcSample[] => {
    const t = Date.parse(r.at);
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    return Number.isFinite(t) && Number.isFinite(v) ? [[t, v]] : [];
  });
}

export type MarketBoardData = {
  game: Game;
  index: IndexSnapshot;
  assetCount: number;
  best: Mover[];
  worst: Mover[];
  lastTrades: LastTrade[];
  news: NewsItem | null;
};

/** Semua yang dibutuhkan layar Display pasar. Tidak memuat saldo tim atau nama tim di transaksi (docs/17). */
export async function fetchMarketBoard(supabase: Db): Promise<MarketBoardData | null> {
  const [assets, index, game, news, dayOpen, trades] = await Promise.all([
    supabase.from("assets").select("id,symbol,name,price,last_price").eq("is_active", true),
    supabase.rpc("get_market_index"),
    fetchGame(supabase),
    fetchNews(supabase, 1),
    supabase.rpc("get_day_open_prices"),
    supabase.rpc("get_last_transactions", { p_limit: 6 }),
  ]);
  if (assets.error || !assets.data || index.error || !index.data || !game) return null;

  // Harga open hari ini (get_day_open_prices); gagal dimuat → harga acuan (perilaku lama), layar tetap tampil.
  const opens = new Map((dayOpen.data ?? []).map((o) => [o.asset_id, o.open_price]));
  const rows = assets.data.flatMap((a) => {
    const lastPrice = a.last_price ?? a.price;
    return isMoney(lastPrice) && isMoney(a.price)
      ? [
          {
            symbol: a.symbol,
            name: a.name,
            openPrice: isMoney(opens.get(a.id)) ? (opens.get(a.id) as number) : a.price,
            lastPrice,
          },
        ]
      : [];
  });
  const { best, worst } = movers(rows);
  return {
    game,
    index: parseIndex(index.data),
    assetCount: rows.length,
    best,
    worst,
    lastTrades: mapLastTrades(trades.data ?? [], 3),
    news: news?.[0] ?? null,
  };
}

export type NewsBoardData = {
  game: Game;
  /** Terbaru dulu. Hanya judul, isi, dan waktu tayang (`news_feed`): tanpa efek harga. */
  news: NewsItem[];
};

/** Berita yang sudah tayang untuk layar Display berita. Hanya yang terbaru (layar tidak digulir). */
export async function fetchNewsBoard(supabase: Db, limit = 6): Promise<NewsBoardData | null> {
  const [game, news] = await Promise.all([fetchGame(supabase), fetchNews(supabase, limit)]);
  if (!game || !news) return null;
  return { game, news };
}
