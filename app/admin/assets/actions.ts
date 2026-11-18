"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { setStockSchema, upsertAssetSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Isian belum benar. Periksa kode, harga, rentang, dan stok.",
  code: "invalid_input",
  retryable: false,
};

/** Ubah stok bandar (`admin_set_stock`; boleh sesudah game dibuka; alasan wajib; tercatat di audit). */
export async function setStock(input: unknown): Promise<ActionResult> {
  const parsed = setStockSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_stock", {
    p_asset_id: parsed.data.assetId,
    p_stock: parsed.data.stock,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_stock] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}

/** Tambah/ubah aset (`admin_upsert_asset`). Hanya sebelum game dibuka: sesudahnya database menjawab `game_started_locked`. */
export async function upsertAsset(input: unknown): Promise<ActionResult> {
  const parsed = upsertAssetSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_asset", {
    p_asset_id: v.assetId as string, // null = aset baru (tipe hasil generate menganggap wajib)
    p_symbol: v.symbol,
    p_name: v.name,
    p_sector: v.sector,
    p_price: v.price,
    p_min_price: v.minPrice,
    p_max_price: v.maxPrice,
    p_stock: v.stock,
    p_is_active: v.active,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_upsert_asset] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
