"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { awardPayoutSchema, resolveTeamSchema, setPostOpenSchema } from "@/lib/schemas/guard";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

export type ResolvedTeam = { teamId: string; name: string; cash: number };

/**
 * Kartu tim → id, nama, dan saldo SAAT INI (`resolve_team_qr`; docs/04 §3.2). Hanya bagian rahasia kartu yang dikirim
 * (`token`); ia tidak dicatat, tidak disimpan, dan tidak ada di URL. Peran guard/admin dicek di proxy dan di database.
 * Saldo hanya untuk ditampilkan di form dan tidak dipakai untuk membatasi nominal.
 */
export async function resolveTeam(input: unknown): Promise<ActionResult<ResolvedTeam>> {
  const parsed = resolveTeamSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_team_qr", { p_qr: parsed.data.token });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[resolve_team_qr] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.team_id || row.cash === null || row.cash === undefined)
    return { ok: false, message: "Tim tidak ditemukan.", code: "team_not_found", retryable: false };
  return { ok: true, data: { teamId: row.team_id, name: row.team_name ?? "Tim", cash: row.cash } };
}

/**
 * Kirim hadiah ke satu tim (`award_payout`). Idempotent menurut `requestId`: kirim ulang dengan id yang sama tidak
 * menggandakan hadiah. Saldo tim bertambah seketika; pos harus terbuka dan game `open`/`paused` (database memutuskan).
 */
export async function awardPayout(input: unknown): Promise<ActionResult> {
  const parsed = awardPayoutSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_payout", {
    p_request_id: v.requestId,
    p_team_id: v.teamId,
    p_amount: v.amount,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable) console.error("[award_payout] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}

/** Buka/tutup pos milik penjaga (`guard_set_post_open`). Ditolak database setelah game selesai. */
export async function setMyPostOpen(input: unknown): Promise<ActionResult<boolean>> {
  const parsed = setPostOpenSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guard_set_post_open", { p_open: parsed.data.open });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[guard_set_post_open] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: data === true };
}
