"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { setPostOpenSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";

/** Ubah ketersediaan pos (Tersedia / Tidak tersedia) oleh admin (`admin_set_post_open`; ditolak saat game selesai; tercatat di audit). */
export async function setPostOpen(input: unknown): Promise<ActionResult> {
  const parsed = setPostOpenSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Input tidak valid.", code: "invalid_input", retryable: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_post_open", {
    p_post_id: parsed.data.postId,
    p_open: parsed.data.open,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_post_open] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
