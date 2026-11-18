"use server";

import { ROLE_HOME, isAppRole } from "@/lib/auth/routes";
import { authEmail } from "@/lib/qr";
import { staffLoginSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginResult = { ok: false; message: string } | { ok: true; redirectTo: string };

const WRONG = "Nama akun atau kata sandi salah.";

/**
 * Masuk staf: admin, penjaga, display. Memakai klien server dengan sesi pengguna (cookie diset di sini).
 * Akun TIM tidak boleh masuk lewat formulir ini: tim hanya masuk dengan memindai kartu QR di laptop trading
 * (docs/02 §3.5); kata sandinya adalah rahasia QR dan tidak pernah diketik.
 * Pesan galat sengaja sama untuk akun yang tidak ada dan kata sandi salah.
 */
export async function signInStaff(input: unknown): Promise<LoginResult> {
  const parsed = staffLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: WRONG };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail(parsed.data.username),
    password: parsed.data.password,
  });
  if (error) {
    const limited = error.status === 429 || /rate limit|too many/i.test(error.message);
    return {
      ok: false,
      message: limited ? "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi." : WRONG,
    };
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    : { data: null };
  const role = isAppRole(profile?.role) ? profile.role : null;

  if (!role || role === "team") {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        role === "team"
          ? "Tim masuk dengan memindai kartu QR di laptop trading."
          : "Akun ini belum punya peran.",
    };
  }
  // Dikembalikan (bukan `redirect()`): klien memuat ulang penuh ke halaman perannya supaya cookie sesi baru terbaca.
  return { ok: true, redirectTo: ROLE_HOME[role] };
}
