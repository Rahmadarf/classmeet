import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Klien server dengan SESI PENGGUNA (JWT milik pengguna), bukan service role.
 * Dengan begitu `auth.uid()` di dalam RPC adalah pengguna sebenarnya dan RLS tetap berlaku.
 *
 * Memakai `cookies()`: panggil hanya dari server action, route handler, atau komponen
 * yang dibungkus <Suspense> (proyek memakai cacheComponents).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { serverUrl, anonKey, cookieName } = supabaseEnv();

  return createServerClient<Database>(serverUrl, anonKey, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component (cookie tidak bisa ditulis); proxy yang menyegarkan sesi.
        }
      },
    },
  });
}
