"use server";

import { z } from "zod";
import { mapRpcError } from "@/lib/errors";
import { setNewsBankruptcySchema, setNewsEventSchema } from "@/lib/schemas/admin";
import { uuidSchema, type ActionResult } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";

/** Tandai siap / keluarkan berita dari kumpulan (`admin_set_news_ready`). Hanya SEBELUM game dibuka; sesudahnya database menolak. */
export async function setNewsReady(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ newsId: uuidSchema, ready: z.boolean() }).safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Input tidak valid.", code: "invalid_input", retryable: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_news_ready", {
    p_news_id: parsed.data.newsId,
    p_ready: parsed.data.ready,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_news_ready] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}

/**
 * Mulai ulang berita (`admin_restart_news`): semua berita terpakai/tayang kembali ke kumpulan, daftar berita tim dan catatan
 * event dikosongkan, jeda dan masa tenang event dimulai lagi. Harga dan saldo tidak berubah. Mengembalikan jumlah berita yang
 * dikembalikan. Ditolak setelah game selesai.
 */
export async function restartNews(): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_restart_news");
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_restart_news] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: typeof data === "number" ? data : 0 };
}

/**
 * Pasang/lepas aset bangkrut pada berita draf (`admin_set_news_bankruptcy`). Hanya SEBELUM game dibuka.
 * Mengembalikan jumlah berita LAIN yang masih punya efek harga pada aset itu (berita itu akan gagal terbit).
 */
export async function setNewsBankruptcy(input: unknown): Promise<ActionResult<number>> {
  const parsed = setNewsBankruptcySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Input tidak valid.", code: "invalid_input", retryable: false };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_news_bankruptcy", {
    p_news_id: v.newsId,
    p_asset_id: v.assetId as string, // null = lepas (fungsi menerima null)
    p_liquidation_bps: v.liquidationPct * 100,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_news_bankruptcy] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: typeof data === "number" ? data : 0 };
}

/**
 * Pasang/lepas event dividen atau suspensi pada berita draf (`admin_set_news_event`). Hanya SEBELUM game dibuka.
 * Dividen dikirim sebagai bps (persen × 100); suspensi dalam menit.
 */
export async function setNewsEvent(input: unknown): Promise<ActionResult> {
  const parsed = setNewsEventSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Input tidak valid.", code: "invalid_input", retryable: false };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_news_event", {
    p_news_id: v.newsId,
    p_asset_id: v.assetId,
    p_kind: v.kind,
    p_amount: (v.amount === null ? null : v.kind === "dividend" ? v.amount * 100 : v.amount) as number,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_set_news_event] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
