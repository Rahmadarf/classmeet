"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { adjustCashSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Koreksi saldo (`admin_adjust_cash`, docs/04 §3.5): selisih bilangan bulat bukan nol + alasan wajib. Hanya admin
 * (dicek di proxy dan di dalam fungsi). Tercatat di `audit_log` oleh database; satu-satunya cara membatalkan hadiah
 * yang salah. Mengurangi lebih dari saldo bebas ditolak (`insufficient_cash`).
 */
export async function adjustCash(input: unknown): Promise<ActionResult<{ after: number }>> {
  const parsed = adjustCashSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Isi selisih (bukan nol) dan alasan minimal 3 huruf.",
      code: "invalid_input",
      retryable: false,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_cash", {
    p_team_id: parsed.data.teamId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_adjust_cash] galat tak terduga:", error.message);
    return {
      ok: false,
      ...mapped,
      message:
        mapped.code === "insufficient_cash"
          ? "Saldo bebas tim tidak cukup untuk pengurangan ini."
          : mapped.message,
    };
  }
  return { ok: true, data: { after: Number(data) } };
}
