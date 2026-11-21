/**
 * Nama cookie sesi Supabase: `sb-<host pertama>-auth-token` (aturan bawaan @supabase/ssr). Dihitung dari alamat PUBLIK
 * dan diberikan eksplisit ke SEMUA klien (browser, server, proxy) agar tetap sama walau server memakai alamat internal
 * (`SUPABASE_INTERNAL_URL`). Berkas ini sengaja kecil dan tanpa env server supaya aman diimpor dari kode browser.
 */
export function authCookieName(publicUrl: string): string {
  return `sb-${new URL(publicUrl).hostname.split(".")[0]}-auth-token`;
}
