import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Klien SERVICE ROLE: melewati RLS. HANYA untuk server action admin yang membuat akun (tim baru, penjaga baru), karena
 * pembuatan pengguna Supabase Auth tidak bisa dilakukan lewat fungsi SQL. Kuncinya dibaca dari `SUPABASE_SERVICE_ROLE_KEY`
 * (tanpa awalan NEXT_PUBLIC, jadi tidak pernah masuk ke browser). Panggil hanya SETELAH peran admin diperiksa
 * (`requireAdmin`), jangan pernah dari komponen klien, dan jangan dicatat di log.
 */
export class ServiceKeyMissing extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY belum diatur di server");
  }
}

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ServiceKeyMissing();
  const { url } = supabaseEnv();
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
