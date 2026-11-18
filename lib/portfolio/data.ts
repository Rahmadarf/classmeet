import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildPortfolio, type Portfolio } from "./view";

type Db = SupabaseClient<Database>;

/** Kepemilikan tim (RLS: baris sendiri) digabung dengan harga peringkat aset. null bila salah satu gagal dimuat. */
export async function fetchPortfolio(supabase: Db): Promise<Portfolio | null> {
  const [holdings, assets] = await Promise.all([
    supabase.from("holdings").select("asset_id,qty,locked_qty,cost_basis"),
    supabase.from("assets").select("id,symbol,name,rank_price,price"),
  ]);
  if (holdings.error || !holdings.data || assets.error || !assets.data) return null;
  return buildPortfolio(
    holdings.data.map((h) => ({
      assetId: h.asset_id,
      qty: h.qty,
      locked: h.locked_qty,
      costBasis: h.cost_basis,
    })),
    assets.data.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      rankPrice: a.rank_price,
      price: a.price,
    })),
  );
}
