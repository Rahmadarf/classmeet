import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGame, type Game } from "@/lib/market/data";
import type { Database } from "@/lib/supabase/database.types";
import { isMoney } from "@/lib/money";
import { fetchNews, type NewsItem } from "@/lib/team/data";
import {
  lastTrades,
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

export type MarketBoardData = {
  game: Game;
  index: IndexSnapshot;
  assetCount: number;
  best: Mover[];
  worst: Mover[];
  lastTrades: LastTrade[];
  news: NewsItem | null;
};

/** Semua yang dibutuhkan layar Display pasar. Tidak memuat saldo tim atau order book (docs/12 §9). */
export async function fetchMarketBoard(supabase: Db): Promise<MarketBoardData | null> {
  const [assets, index, game, news] = await Promise.all([
    supabase.from("assets").select("symbol,name,price,last_price,last_trade_at").eq("is_active", true),
    supabase.rpc("get_market_index"),
    fetchGame(supabase),
    fetchNews(supabase, 1),
  ]);
  if (assets.error || !assets.data || index.error || !index.data || !game) return null;

  const rows = assets.data.flatMap((a) => {
    const lastPrice = a.last_price ?? a.price;
    return isMoney(lastPrice) && isMoney(a.price)
      ? [{ symbol: a.symbol, name: a.name, refPrice: a.price, lastPrice, lastTradeAt: a.last_trade_at }]
      : [];
  });
  const { best, worst } = movers(rows);
  return {
    game,
    index: parseIndex(index.data),
    assetCount: rows.length,
    best,
    worst,
    lastTrades: lastTrades(rows),
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
