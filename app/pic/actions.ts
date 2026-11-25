"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { expectedPicPin, PinLimiter, pinMatches } from "@/lib/guard/pin";
import { awardPayoutSchema, verifyPinSchema } from "@/lib/schemas/guard";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

const pinLimiter = new PinLimiter();

/**
 * Periksa PIN PIC lomba sebelum hadiah dimasukkan ke antrean. Dibandingkan di server dengan `PIC_PIN` (bawaan 54321,
 * SENGAJA berbeda dari `GUARD_PIN`) tanpa dikirim ke klien dan tanpa dicatat; 5 salah berturut-turut mengunci akun itu 60 dtk.
 * Pengaman salah-kirim, bukan pengganti login: `award_pic_payout` tetap hanya menerima peran `pic`.
 */
export async function verifyPicPin(input: unknown): Promise<ActionResult> {
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
  if (!pinMatches(parsed.data.pin, expectedPicPin())) {
    pinLimiter.fail(key, Date.now());
    return { ok: false, message: "PIN salah.", code: "pin_invalid", retryable: false };
  }
  pinLimiter.succeed(key);
  return { ok: true, data: undefined };
}

/**
 * Kirim hadiah lomba ke satu tim (`award_pic_payout`). Idempotent menurut `requestId`. Saldo tim bertambah seketika;
 * game harus `open`/`paused` (database memutuskan). Tidak ada saklar buka/tutup untuk lomba.
 */
export async function awardPicPayout(input: unknown): Promise<ActionResult> {
  const parsed = awardPayoutSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_pic_payout", {
    p_request_id: v.requestId,
    p_team_id: v.teamId,
    p_amount: v.amount,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[award_pic_payout] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
