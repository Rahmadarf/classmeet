"use server";

import { randomUUID } from "node:crypto";
import { makeShortCode, nextNumber } from "@/lib/admin/accounts";
import { deleteLimiter, passcodeMatches } from "@/lib/admin/passcode";
import { requireAdmin } from "@/lib/admin/require-admin";
import { qrDataUrl } from "@/lib/admin/qr-png";
import { mapRpcError } from "@/lib/errors";
import { authEmail, formatTeamQr } from "@/lib/qr";
import type { ActionResult } from "@/lib/schemas/common";
import { adjustCashSchema, createTeamSchema, deleteTeamSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, ServiceKeyMissing } from "@/lib/supabase/service";

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

export type NewTeam = { teamId: string; name: string; username: string; qr: string | null };

/**
 * Tambah tim baru (akun tim = Supabase Auth user dengan kata sandi = `qr_token`, sama seperti skrip seed). Dibuat dengan service
 * role setelah peran admin diperiksa. Username (`timN`), `qr_token`, dan kode cadangan dibuat otomatis. Mengembalikan QR sebagai
 * GAMBAR (data URI); token tidak dikembalikan sebagai teks dan tidak dicatat. Tim mulai dengan saldo 0. Tercatat di audit.
 */
export async function createTeam(input: unknown): Promise<ActionResult<NewTeam>> {
  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Nama tim 2–40 huruf.", code: "invalid_input", retryable: false };
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) return { ok: false, message: "Hanya admin.", code: "forbidden", retryable: false };

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (e) {
    if (e instanceof ServiceKeyMissing)
      return {
        ok: false,
        message:
          "Kunci layanan server belum diatur (SUPABASE_SERVICE_ROLE_KEY di .env.local), lalu mulai ulang server.",
        code: "service_key_missing",
        retryable: false,
      };
    throw e;
  }

  const name = parsed.data.name;
  const [{ data: teamRows }, { data: profileRows }] = await Promise.all([
    svc.from("teams").select("name,short_code"),
    svc.from("profiles").select("username").like("username", "tim%"),
  ]);
  if ((teamRows ?? []).some((t) => t.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, message: "Nama tim sudah dipakai.", code: "team_name_taken", retryable: false };
  const username = `tim${nextNumber(
    "tim",
    (profileRows ?? []).map((p) => p.username),
  )}`;
  const shortCode = makeShortCode(new Set((teamRows ?? []).map((t) => t.short_code)));
  const token = randomUUID();

  const created = await svc.auth.admin.createUser({
    email: authEmail(username),
    password: token,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    console.error("[createTeam] createUser gagal:", created.error?.message);
    return { ok: false, message: "Akun tim gagal dibuat.", code: null, retryable: true };
  }
  const id = created.data.user.id;
  const rollback = async () => {
    await svc.from("teams").delete().eq("id", id);
    await svc.from("profiles").delete().eq("id", id);
    await svc.auth.admin.deleteUser(id);
  };
  const profile = await svc.from("profiles").insert({ id, username, role: "team", display_name: name });
  if (profile.error) {
    await rollback();
    return { ok: false, message: "Profil tim gagal dibuat.", code: null, retryable: true };
  }
  const team = await svc.from("teams").insert({ id, name, qr_token: token, short_code: shortCode });
  if (team.error) {
    await rollback();
    return { ok: false, message: "Tim gagal dibuat.", code: null, retryable: true };
  }
  await svc.from("audit_log").insert({
    actor_id: adminId,
    action: "create_team",
    payload: { team_id: id, name, username },
  });
  const qr = await qrDataUrl(formatTeamQr({ username, token }));
  return { ok: true, data: { teamId: id, name, username, qr } };
}

/**
 * Hapus tim (soft delete, `admin_delete_team`): butuh PASCODE 6 digit (bawaan 223332; `ADMIN_DELETE_PASSCODE` di server),
 * dibandingkan di server dengan perbandingan waktu-tetap; 5 salah berturut-turut mengunci admin itu 60 dtk. Order antre tim
 * dibatalkan, tim hilang dari peringkat dan tidak bisa dipindai, kartu QR lama mati, riwayat transaksi tetap tersimpan.
 * Akun loginnya dinonaktifkan dengan service role bila kuncinya ada.
 */
export async function deleteTeam(input: unknown): Promise<ActionResult<{ loginDisabled: boolean }>> {
  const parsed = deleteTeamSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Pascode terdiri dari 6 angka.", code: "pin_invalid", retryable: false };
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) return { ok: false, message: "Hanya admin.", code: "forbidden", retryable: false };

  const wait = deleteLimiter.lockedFor(adminId, Date.now());
  if (wait > 0)
    return {
      ok: false,
      message: `Terlalu banyak pascode salah. Coba lagi dalam ${wait} detik.`,
      code: "rate_limited",
      retryable: false,
    };
  if (!passcodeMatches(parsed.data.passcode)) {
    deleteLimiter.fail(adminId, Date.now());
    return { ok: false, message: "Pascode salah.", code: "pin_invalid", retryable: false };
  }
  deleteLimiter.succeed(adminId);

  const { error } = await supabase.rpc("admin_delete_team", { p_team_id: parsed.data.teamId });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_delete_team] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  let loginDisabled = false;
  try {
    const svc = createServiceClient();
    const res = await svc.auth.admin.updateUserById(parsed.data.teamId, { ban_duration: "876000h" });
    loginDisabled = !res.error;
  } catch {
    // kunci service role tidak ada: tim tetap terhapus (QR mati, tidak bisa order), hanya login lama belum diblokir
  }
  return { ok: true, data: { loginDisabled } };
}
