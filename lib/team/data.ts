import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMoney } from "@/lib/money";

type Db = SupabaseClient<Database>;

/**
 * Ringkasan uang tim dari `get_my_summary()` (docs/04 §3.3).
 * - `cash`          saldo
 * - `holdingsValue` nilai aset menurut harga tayang saat ini (docs/17)
 * - `netWorth`      cash + holdingsValue (yang dipakai peringkat)
 */
export type Summary = {
  cash: number;
  holdingsValue: number;
  netWorth: number;
};

export async function fetchSummary(supabase: Db): Promise<Summary | null> {
  const { data, error } = await supabase.rpc("get_my_summary");
  if (error || !data) return null;
  const { cash, holdings_value, net_worth } = data;
  if (!isMoney(cash) || !isMoney(holdings_value) || !isMoney(net_worth)) return null;
  return { cash, holdingsValue: holdings_value, netWorth: net_worth };
}

/** Berita yang sudah tayang (tabel `news_feed`: judul, isi, waktu tayang; TANPA efek maupun waktu efek). */
export type NewsItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export async function fetchNews(supabase: Db, limit = 30): Promise<NewsItem[] | null> {
  const { data, error } = await supabase
    .from("news_feed")
    .select("news_id,title,body,published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.news_id,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
  }));
}
