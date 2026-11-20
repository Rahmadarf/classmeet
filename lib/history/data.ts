import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildHistory, type HistoryItem } from "./view";

type Db = SupabaseClient<Database>;

/** Batas baca: cukup untuk satu acara; tim melihat yang terbaru lebih dulu. */
const TRADE_LIMIT = 300;
const PAYOUT_LIMIT = 100;
const DIVIDEND_LIMIT = 100;

/**
 * Transaksi (`transactions`), hadiah pos (`payouts`), dan dividen (`dividends`) milik tim, digabung jadi satu lini masa. RLS membatasi
 * tabel ke baris tim ini. Hadiah ditulis penjaga lewat `award_payout`; tim hanya membaca. null bila gagal dimuat.
 */
export async function fetchHistory(supabase: Db, myId: string): Promise<HistoryItem[] | null> {
  const [trades, payouts, assets, posts, dividends] = await Promise.all([
    supabase
      .from("transactions")
      .select("id,asset_id,side,qty,unit_price,list_price,total,created_at")
      .eq("team_id", myId)
      .order("id", { ascending: false })
      .limit(TRADE_LIMIT),
    supabase
      .from("payouts")
      .select("id,post_id,amount,note,created_at")
      .eq("team_id", myId)
      .order("id", { ascending: false })
      .limit(PAYOUT_LIMIT),
    supabase.from("assets").select("id,symbol,name"),
    supabase.from("posts").select("id,name,location"),
    supabase
      .from("dividends")
      .select("id,asset_id,qty,per_unit,amount,paid_at")
      .eq("team_id", myId)
      .order("id", { ascending: false })
      .limit(DIVIDEND_LIMIT),
  ]);
  if (trades.error || !trades.data || payouts.error || !payouts.data || assets.error || !assets.data)
    return null;
  if (posts.error || !posts.data || dividends.error || !dividends.data) return null;

  return buildHistory(
    trades.data.flatMap((t) =>
      t.side === "buy" || t.side === "sell"
        ? [
            {
              id: t.id,
              assetId: t.asset_id,
              side: t.side,
              price: t.unit_price,
              listPrice: t.list_price,
              qty: t.qty,
              total: t.total,
              createdAt: t.created_at,
            },
          ]
        : [],
    ),
    payouts.data.map((p) => ({
      id: p.id,
      postId: p.post_id,
      amount: p.amount,
      note: p.note,
      createdAt: p.created_at,
    })),
    Object.fromEntries(assets.data.map((a) => [a.id, { symbol: a.symbol, name: a.name }])),
    Object.fromEntries(posts.data.map((p) => [p.id, { name: p.name, location: p.location }])),
    dividends.data.map((d) => ({
      id: d.id,
      assetId: d.asset_id,
      qty: d.qty,
      perUnit: d.per_unit,
      amount: d.amount,
      createdAt: d.paid_at,
    })),
  );
}
