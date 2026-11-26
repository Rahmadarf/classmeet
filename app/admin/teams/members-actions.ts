"use server";

import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { deleteMemberSchema, importMembersSchema, saveMemberSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

export type ImportSummary = { teams: number; removed: number; added: number };

/**
 * Impor anggota tim (`admin_import_team_members`): MENGGANTI seluruh anggota tiap tim yang ada di berkas (tim lain tidak
 * tersentuh), dalam satu transaksi, jadi satu tim yang tidak dikenal membatalkan semuanya. Hanya admin (dicek di database);
 * memakai sesi admin sendiri, tanpa kunci service role. Berkas diurai di peramban (`lib/admin/members.ts`) dan database memvalidasi
 * ulang. Nama dan kelas anggota tidak dicatat di log atau audit; yang tercatat hanya jumlah.
 */
export async function importTeamMembers(input: unknown): Promise<ActionResult<ImportSummary>> {
  const parsed = importMembersSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_import_team_members", { p_rows: parsed.data.rows });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_import_team_members] galat tak terduga:", error.message);
    return {
      ok: false,
      ...mapped,
      message:
        mapped.code === "team_not_found"
          ? "Ada nama tim di berkas yang tidak ditemukan. Muat ulang daftar tim lalu coba lagi."
          : mapped.message,
    };
  }
  const r = (data ?? {}) as { teams?: number; removed?: number; added?: number };
  return { ok: true, data: { teams: r.teams ?? 0, removed: r.removed ?? 0, added: r.added ?? 0 } };
}

/** Tambah atau ubah satu anggota (`admin_upsert_team_member`). */
export async function saveTeamMember(input: unknown): Promise<ActionResult<{ memberId: number }>> {
  const parsed = saveMemberSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Isi nama anggota (maksimal 80 huruf).",
      code: "invalid_input",
      retryable: false,
    };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_team_member", {
    p_member_id: v.memberId as unknown as number,
    p_team_id: v.teamId,
    p_name: v.name,
    p_class: (v.className === "" ? null : v.className) as unknown as string,
    p_captain: v.captain,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_upsert_team_member] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: { memberId: Number(data) } };
}

/** Hapus satu anggota (`admin_delete_team_member`). */
export async function deleteTeamMember(input: unknown): Promise<ActionResult> {
  const parsed = deleteMemberSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_team_member", { p_member_id: parsed.data.memberId });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_delete_team_member] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
