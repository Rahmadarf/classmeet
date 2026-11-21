import { authCookieName } from "./cookie-name";

/**
 * Hanya kunci publik. `SUPABASE_SERVICE_ROLE_KEY` TIDAK BOLEH dibaca di sini atau di kode aplikasi mana pun
 * (hanya `scripts/*.ts` di laptop panitia).
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi (lihat .env.example).",
    );
  }
  return {
    /** Alamat PUBLIK Supabase (dipakai browser; sama dengan NEXT_PUBLIC_SUPABASE_URL). */
    url,
    /**
     * Alamat yang dipakai kode SERVER (proxy, server action, komponen server). Bila `SUPABASE_INTERNAL_URL` diisi
     * (mis. http://localhost:8000 saat Next dan Supabase satu mesin), panggilan server tidak lagi memutar lewat internet
     * dan Cloudflare. Kosong: memakai alamat publik. Tidak pernah dikirim ke browser.
     */
    serverUrl: process.env.SUPABASE_INTERNAL_URL?.trim() || url,
    anonKey,
    /** Nama cookie sesi, selalu dari alamat PUBLIK supaya browser dan server memakai cookie yang sama. */
    cookieName: authCookieName(url),
  };
}

/**
 * Akun layar publik yang dimasuki OTOMATIS di server saat `/display` dibuka tanpa sesi (layar ruang publik tidak perlu
 * login). Hanya dibaca di server (tanpa awalan NEXT_PUBLIC_, tidak pernah dikirim ke peramban). Keduanya harus diisi;
 * bila salah satu kosong, masuk otomatis dimatikan dan `/display` kembali meminta login seperti biasa.
 * Ini akun peran `display` biasa (hanya baca; docs/06 §1), BUKAN service_role.
 */
export function displayCredentials(
  env: Record<string, string | undefined> = process.env,
): { email: string; password: string } | null {
  const username = env.DISPLAY_USERNAME?.trim();
  const password = env.DISPLAY_PASSWORD;
  if (!username || !password) return null;
  return { email: `${username.toLowerCase()}@classmeet.local`, password };
}
