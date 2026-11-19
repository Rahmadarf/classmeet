"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { expectedPin, PinLimiter, pinMatches } from "@/lib/guard/pin";
import {
  awardPayoutSchema,
  resolveTeamSchema,
  setPostOpenSchema,
  verifyPinSchema,
} from "@/lib/schemas/guard";
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

const pinLimiter = new PinLimiter();

/**
 * Periksa PIN penjaga sebelum hadiah dimasukkan ke antrean (form hadiah). PIN dibandingkan di server dengan
 * `GUARD_PIN` (bawaan 12345) tanpa dikirim ke klien dan tanpa dicatat; 5 salah berturut-turut mengunci akun itu 60 dtk.
 * Ini pengaman salah-kirim, bukan pengganti login: `award_payout` tetap hanya menerima peran guard.
 */
export async function verifyGuardPin(input: unknown): Promise<ActionResult> {
  const parsed = verifyPinSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "PIN terdiri dari 4–8 angka.", code: "pin_invalid", retryable: false };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    return { ok: false, message: "Sesi berakhir. Masuk lagi.", code: "forbidden", retryable: false };
  const key = data.user.id;
  const wait = pinLimiter.lockedFor(key, Date.now());
  if (wait > 0)
    return {
      ok: false,
      message: `Terlalu banyak PIN salah. Coba lagi dalam ${wait} detik.`,
      code: "rate_limited",
      retryable: false,
    };
  if (!pinMatches(parsed.data.pin, expectedPin())) {
    pinLimiter.fail(key, Date.now());
    return { ok: false, message: "PIN salah.", code: "pin_invalid", retryable: false };
  }
  pinLimiter.succeed(key);
  return { ok: true, data: undefined };
}

/**
 * Kirim hadiah ke satu tim (`award_payout`). Idempotent menurut `requestId`: kirim ulang dengan id yang sama tidak
 * menggandakan hadiah. Saldo tim bertambah seketika; game harus `open`/`paused` (database memutuskan); status pos TIDAK menolak hadiah (19 Nov).
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

/** Ubah ketersediaan pos milik penjaga (Tersedia / Tidak tersedia) (`guard_set_post_open`). Ditolak database setelah game selesai. */
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
