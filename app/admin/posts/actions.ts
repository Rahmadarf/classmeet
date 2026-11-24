"use server";

import { nextNumber, nextPostNumber, postDisplayName } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/require-admin";
import { mapRpcError } from "@/lib/errors";
import { authEmail } from "@/lib/qr";
import type { ActionResult } from "@/lib/schemas/common";
import { createPostSchema, deletePostSchema, setPostOpenSchema } from "@/lib/schemas/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, ServiceKeyMissing } from "@/lib/supabase/service";

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

export type NewPost = { postId: string; name: string; guardUsername: string };

/**
 * Tambah pos baru beserta akun penjaganya. Akun penjaga (Supabase Auth, username `guardN`) dibuat dengan service role setelah
 * peran admin diperiksa; pos dibuat lewat `admin_upsert_post` memakai sesi admin sendiri (divalidasi dan diaudit database).
 * Pos baru mulai Tidak tersedia. Kata sandi awal penjaga diisi admin dan tidak dikembalikan atau dicatat.
 */
export async function createPost(input: unknown): Promise<ActionResult<NewPost>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Nama game dan lokasi 2+ huruf, kata sandi penjaga minimal 8 karakter.",
      code: "invalid_input",
      retryable: false,
    };
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

  const [{ data: guards }, { data: posts }] = await Promise.all([
    svc.from("profiles").select("username").like("username", "guard%"),
    svc.from("posts").select("name"),
  ]);
  const n = nextNumber(
    "guard",
    (guards ?? []).map((g) => g.username),
  );
  const guardUsername = `guard${n}`;
  const postNo = nextPostNumber((posts ?? []).map((p) => p.name));
  const name = postDisplayName(postNo, parsed.data.gameName);

  const created = await svc.auth.admin.createUser({
    email: authEmail(guardUsername),
    password: parsed.data.password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    console.error("[createPost] createUser gagal:", created.error?.message);
    return {
      ok: false,
      message: "Akun penjaga gagal dibuat (kata sandi terlalu lemah?).",
      code: null,
      retryable: false,
    };
  }
  const guardId = created.data.user.id;
  const rollback = async () => {
    await svc.from("profiles").delete().eq("id", guardId);
    await svc.auth.admin.deleteUser(guardId);
  };
  const profile = await svc
    .from("profiles")
    .insert({ id: guardId, username: guardUsername, role: "guard", display_name: `Penjaga Pos ${postNo}` });
  if (profile.error) {
    await rollback();
    return { ok: false, message: "Profil penjaga gagal dibuat.", code: null, retryable: true };
  }
  const { data: postId, error } = await supabase.rpc("admin_upsert_post", {
    p_post_id: null as unknown as string,
    p_name: name,
    p_location: parsed.data.location,
    p_guard_id: guardId,
  });
  if (error || !postId) {
    await rollback();
    const mapped = mapRpcError(error);
    return { ok: false, ...mapped };
  }
  await svc.from("audit_log").insert({
    actor_id: adminId,
    action: "create_guard",
    payload: { guard_id: guardId, username: guardUsername, post_id: postId },
  });
  return { ok: true, data: { postId, name, guardUsername } };
}

/**
 * Hapus pos beserta akun penjaganya (`admin_delete_post`): HANYA saat status game `setup` (`game_not_setup` selain itu), hanya admin,
 * dan ditolak bila pos pernah memberi hadiah (`post_has_payouts`). Database menghapus pos, profil, dan akun Auth penjaga dalam satu
 * transaksi serta mencatat `delete_post` di audit. Tidak bisa dibatalkan.
 */
export async function deletePost(input: unknown): Promise<ActionResult> {
  const parsed = deletePostSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Pos tidak valid.", code: "invalid_input", retryable: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_post", { p_post_id: parsed.data.postId });
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable)
      console.error("[admin_delete_post] galat tak terduga:", error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}
