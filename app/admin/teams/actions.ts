"use server";

import { randomUUID } from "node:crypto";
import { makeShortCode, nextNumber } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/require-admin";
import { qrDataUrl } from "@/lib/admin/qr-png";
import { mapRpcError } from "@/lib/errors";
import { authEmail, formatTeamQr } from "@/lib/qr";
import type { ActionResult } from "@/lib/schemas/common";
import { adjustCashSchema, createTeamSchema, viewTeamQrSchema } from "@/lib/schemas/admin";
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

export type TeamQrView = { teamId: string; name: string; username: string; qr: string | null };

/**
 * Lihat kartu QR tim yang sudah ada (menggantikan "Ganti QR"). Hanya admin. Rahasia dibaca dengan service role, diubah jadi
 * GAMBAR (data URI) lalu dibuang: token tidak dikembalikan sebagai teks dan tidak dicatat. Tiap permintaan tercatat di audit
 * (`view_team_qr`) karena QR adalah kredensial tim.
 */
export async function getTeamQr(input: unknown): Promise<ActionResult<TeamQrView>> {
  const parsed = viewTeamQrSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Tim tidak valid.", code: "invalid_input", retryable: false };
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

  const [{ data: team }, { data: profile }] = await Promise.all([
    svc.from("teams").select("name,qr_token").eq("id", parsed.data.teamId).maybeSingle(),
    svc.from("profiles").select("username").eq("id", parsed.data.teamId).maybeSingle(),
  ]);
  if (!team || !profile)
    return { ok: false, message: "Tim tidak ditemukan.", code: "team_not_found", retryable: false };

  await svc.from("audit_log").insert({
    actor_id: adminId,
    action: "view_team_qr",
    payload: { team_id: parsed.data.teamId },
  });
  const qr = await qrDataUrl(formatTeamQr({ username: profile.username, token: team.qr_token }));
  return { ok: true, data: { teamId: parsed.data.teamId, name: team.name, username: profile.username, qr } };
}
