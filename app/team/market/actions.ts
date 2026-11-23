"use server";

import { toReport } from "@/lib/analysis/data";
import type { AnalysisReport } from "@/lib/analysis/view";
import { mapRpcError } from "@/lib/errors";
import { buyAnalysisSchema } from "@/lib/schemas/analysis";
import type { ActionResult } from "@/lib/schemas/common";
import { tradeSchema, type TradeResult } from "@/lib/schemas/trade";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

/**
 * Beli atau jual satu aset pada harga tayang (docs/17). Memakai klien Supabase dengan SESI PENGGUNA (bukan service
 * role), sehingga `auth.uid()` di dalam `buy_asset`/`sell_asset` adalah tim yang sedang masuk. Peran dicek di proxy
 * DAN di dalam fungsi database. `requestId` datang dari klien dan dipakai ulang saat percobaan ulang (idempotensi).
 */
export async function tradeAsset(input: unknown): Promise<ActionResult<TradeResult>> {
  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { requestId, assetId, side, qty } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(side === "buy" ? "buy_asset" : "sell_asset", {
    p_request_id: requestId,
    p_asset_id: assetId,
    p_qty: qty,
  });

  if (error || !data) {
    const mapped = mapRpcError(error ?? { message: "empty" });
    if (!mapped.code && !mapped.retryable)
      console.error(`[${side}_asset] galat tak terduga:`, error?.message);
    return { ok: false, ...mapped };
  }
  return {
    ok: true,
    data: {
      transactionId: data.id,
      side,
      qty: data.qty,
      unitPrice: data.unit_price,
      listPrice: data.list_price,
      total: data.total,
    },
  };
}

/**
 * Beli Analisa Pasar untuk berita yang sedang tayang (`buy_analysis`). Sesi pengguna, bukan service role. `requestId`
 * dipakai ulang saat percobaan ulang (idempotensi). Membeli lagi untuk berita yang sama mengembalikan laporan lama
 * tanpa biaya. Harga dan syarat (pasar buka, berita tayang, saldo, jendela waktu) ditegakkan database.
 */
export async function buyAnalysis(input: unknown): Promise<ActionResult<AnalysisReport>> {
  const parsed = buyAnalysisSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buy_analysis", { p_request_id: parsed.data.requestId });
  if (error || !data) {
    const mapped = mapRpcError(error ?? { message: "empty" });
    if (!mapped.code && !mapped.retryable) console.error("[buy_analysis] galat tak terduga:", error?.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: toReport(data) };
}
