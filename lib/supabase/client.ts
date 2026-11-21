import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { authCookieName } from "./cookie-name";

// NEXT_PUBLIC_* harus dirujuk secara literal agar Next menyuntikkannya ke bundel browser.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Nama cookie sama dengan yang dipakai server (yang bisa memakai alamat internal): lihat lib/supabase/env.ts.
    { cookieOptions: { name: authCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL!) } },
  );
}
