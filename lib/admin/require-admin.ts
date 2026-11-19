import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Id pengguna bila sesi sekarang adalah admin, selain itu null. Dipakai SEBELUM memakai klien service role. */
export async function requireAdmin(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
  return profile?.role === "admin" ? uid : null;
}
