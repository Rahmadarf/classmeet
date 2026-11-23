"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import {
  analysisSettingsSchema,
  setStockSchema,
  tradeSettingsSchema,
  upsertAssetSchema,
} from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Isian belum benar. Periksa kode, harga, rentang, dan stok.",
  code: "invalid_input",
  retryable: false,
};

/** Ubah stok pasar (`admin_set_stock`; boleh sesudah game dibuka; alasan wajib; tercatat di audit). */
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

/** Pengaturan toko (`admin_set_trade_settings`). Hanya sebelum game dibuka: sesudahnya database menjawab `game_started_locked`. */
export async function setTradeSettings(input: unknown): Promise<ActionResult> {
  const parsed = tradeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Isian belum benar. Periksa selisih jual, tekanan, lama pemulihan, dan batas pegang.",
      code: "invalid_input",
      retryable: false,
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_trade_settings", {
    p_sell_spread_bps: v.sellSpreadBps,
    p_pressure_bps_per_unit: v.pressureBpsPerUnit,
    p_pressure_cap_bps: v.pressureCapBps,
    p_pressure_decay_minutes: v.pressureDecayMinutes,
    p_hold_cap_pct: v.holdCapPct,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_trade_settings] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}

/** Harga dan saklar Analisa Pasar (`admin_set_analysis_settings`). Boleh kapan saja; berlaku untuk pembelian berikutnya. */
export async function setAnalysisSettings(input: unknown): Promise<ActionResult> {
  const parsed = analysisSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Harga harus bilangan bulat Rp 0 sampai Rp 100.000.000.",
      code: "invalid_input",
      retryable: false,
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_analysis_settings", {
    p_price: parsed.data.price,
    p_enabled: parsed.data.enabled,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_analysis_settings] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
