import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// NEXT_PUBLIC_* harus dirujuk secara literal agar Next menyuntikkannya ke bundel browser.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
