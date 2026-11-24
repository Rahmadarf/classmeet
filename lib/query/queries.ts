import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchIndexHistory, fetchLeaderboard, fetchMarketBoard, fetchNewsBoard } from "@/lib/display/data";
import { fetchHistory } from "@/lib/history/data";
import { fetchGame } from "@/lib/market/data";
import { fetchMarketSnapshot } from "@/lib/market/snapshot";
import { fetchPortfolio } from "@/lib/portfolio/data";
import { fetchPosts } from "@/lib/posts/data";
import { qk } from "@/lib/query/keys";
import { must } from "@/lib/query/options";
import type { Database } from "@/lib/supabase/database.types";
import { fetchNews, fetchSummary } from "@/lib/team/data";

type Db = SupabaseClient<Database>;

/**
 * Definisi query yang dipakai bersama banyak komponen. Hanya sumber data + kunci; interval polling dan data awal
 * ditambahkan komponen pemakai (`pollOptions`, `seed`). Kunci yang sama = panggilan RPC digabung.
 */
export const gameQuery = (db: Db) =>
  queryOptions({ queryKey: qk.game, queryFn: () => must(fetchGame(db), "game") });

/**
 * Seluruh papan Pasar tim dalam SATU panggilan (`get_market_snapshot`; jatuh ke 7 panggilan lama bila fungsinya belum
 * ada di database). Pemeta dan aturan "daftar kosong = gagal" ada di lib/market/snapshot.ts.
 */
export const marketSnapshotQuery = (db: Db) =>
  queryOptions({
    queryKey: qk.marketSnapshot,
    queryFn: () => must(fetchMarketSnapshot(db), "market-snapshot"),
  });

export const summaryQuery = (db: Db) =>
  queryOptions({ queryKey: qk.summary, queryFn: () => must(fetchSummary(db), "summary") });

export const newsQuery = (db: Db, limit: number) =>
  queryOptions({ queryKey: qk.news(limit), queryFn: () => must(fetchNews(db, limit), "news") });

export const portfolioQuery = (db: Db) =>
  queryOptions({ queryKey: qk.portfolio, queryFn: () => must(fetchPortfolio(db), "portfolio") });

export const historyQuery = (db: Db, teamId: string) =>
  queryOptions({ queryKey: qk.history(teamId), queryFn: () => must(fetchHistory(db, teamId), "history") });

export const leaderboardQuery = (db: Db) =>
  queryOptions({
    queryKey: qk.display.leaderboard,
    queryFn: () => must(fetchLeaderboard(db), "leaderboard"),
  });

export const indexHistoryQuery = (db: Db) =>
  queryOptions({
    queryKey: qk.display.indexHistory,
    queryFn: () => must(fetchIndexHistory(db), "index-history"),
  });

export const marketBoardQuery = (db: Db) =>
  queryOptions({
    queryKey: qk.display.marketBoard,
    queryFn: () => must(fetchMarketBoard(db), "market-board"),
  });

export const newsBoardQuery = (db: Db, limit: number) =>
  queryOptions({
    queryKey: qk.display.newsBoard(limit),
    queryFn: () => must(fetchNewsBoard(db, limit), "news-board"),
  });

export const postsQuery = (db: Db) =>
  queryOptions({ queryKey: qk.display.posts, queryFn: () => must(fetchPosts(db), "posts") });

/** Pasar berubah (status, jeda/buka, berita baru): harga, stok, kepemilikan, bangkrut, tawaran analisa. */
export function invalidateMarket(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: qk.marketSnapshot });
}

/**
 * Sesudah transaksi atau beli analisa: seluruh data pasar + saldo + berita, dan juga Portofolio dan Riwayat
 * (yang sedang tidak tampil ditandai kedaluwarsa, jadi langsung diambil ulang saat dibuka).
 */
export function invalidateAfterTrade(queryClient: QueryClient) {
  return Promise.all([
    invalidateMarket(queryClient),
    queryClient.invalidateQueries({ queryKey: qk.summary }),
    queryClient.invalidateQueries({ queryKey: ["news"] }),
    queryClient.invalidateQueries({ queryKey: qk.portfolio }),
    queryClient.invalidateQueries({ queryKey: ["history"] }),
  ]);
}
