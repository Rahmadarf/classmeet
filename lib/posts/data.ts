import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildPostRows, type PostRow } from "./view";

/** `get_post_list()`: nama, lokasi, tersedia atau tidak, hanya pos rally. Bisa dipanggil semua peran yang masuk; tanpa rentang hadiah. */
export async function fetchPosts(supabase: SupabaseClient<Database>): Promise<PostRow[] | null> {
  const { data, error } = await supabase.rpc("get_post_list");
  if (error || !data) return null;
  // Hanya pos rally yang tampil di layar publik; lomba tidak punya status buka/tutup.
  return buildPostRows(
    data
      .filter((p) => p.kind !== "lomba")
      .map((p) => ({ id: p.id, name: p.name, location: p.location, isOpen: p.is_open })),
  );
}
