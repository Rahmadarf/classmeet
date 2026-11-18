"use server";

import { mapRpcError } from "@/lib/errors";
import { cancelOrderSchema, placeOrderSchema, type PlacedOrder } from "@/lib/schemas/order";
import type { ActionResult } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

/**
 * Pasang order. Memakai klien Supabase dengan SESI PENGGUNA (bukan service role), sehingga `auth.uid()` di
 * dalam `place_order` adalah tim yang sedang masuk. Peran dicek di proxy DAN di dalam fungsi database.
 * `requestId` datang dari klien dan dipakai ulang saat percobaan ulang (idempotensi).
 */
export async function placeOrder(input: unknown): Promise<ActionResult<PlacedOrder>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { requestId, assetId, side, kind, price, qty } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_request_id: requestId,
    p_asset_id: assetId,
    p_side: side,
    p_kind: kind,
    // Tipe hasil generate menganggap `p_price` wajib bilangan; order market mengirim NULL (`price` undefined).
    p_price: (kind === "limit" ? price : null) as number,
    p_qty: qty,
  });

  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable) console.error("[place_order] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return {
    ok: true,
    data: {
      orderId: data.id,
      kind,
      side,
      status: data.status,
      qty: data.qty,
      remaining: data.remaining,
      price: data.price,
    },
  };
}

/** Batalkan order antre milik sendiri (pemeriksaan kepemilikan ada di `cancel_order`). */
export async function cancelOrder(input: unknown): Promise<ActionResult<{ orderId: number }>> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order", { p_order_id: parsed.data.orderId });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable) console.error("[cancel_order] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: { orderId: data.id } };
}
