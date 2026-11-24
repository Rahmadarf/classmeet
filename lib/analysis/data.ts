import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AnalysisOffer, AnalysisReason, AnalysisReport } from "./view";

type Db = SupabaseClient<Database>;

const REASONS: AnalysisReason[] = [
  "ok",
  "market_closed",
  "feature_disabled",
  "no_live_news",
  "window_closed",
  "analysis_unavailable",
];

type PurchaseRow = Database["public"]["Tables"]["analysis_purchases"]["Row"];

export const toReport = (r: PurchaseRow): AnalysisReport => ({
  id: r.id,
  newsTitle: r.news_title,
  price: r.price,
  paragraphs: r.paragraphs,
  createdAt: r.created_at,
});

/** Tawaran analisa untuk tim ini (harga, bisa beli, alasan, sudah dimiliki). null bila gagal dimuat. */
export async function fetchAnalysisOffer(supabase: Db): Promise<AnalysisOffer | null> {
  const { data, error } = await supabase.rpc("get_analysis_offer");
  const row = data?.[0];
  if (error || !row) return null;
  return toAnalysisOffer(row);
}

export function toAnalysisOffer(
  row: Database["public"]["Functions"]["get_analysis_offer"]["Returns"][number],
): AnalysisOffer {
  const reason = (REASONS as string[]).includes(row.reason) ? (row.reason as AnalysisReason) : "no_live_news";
  return {
    price: row.price,
    canBuy: row.can_buy,
    reason,
    owned: row.owned,
    newsTitle: row.news_title,
  };
}

/** Laporan yang dibeli tim ini, terbaru lebih dulu. null bila gagal dimuat. */
export async function fetchMyAnalyses(supabase: Db, limit = 20): Promise<AnalysisReport[] | null> {
  const { data, error } = await supabase.rpc("get_my_analyses", { p_limit: limit });
  if (error || !data) return null;
  return data.map(toReport);
}
