import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildPostRows, type PostRow } from "./view";

/** `get_post_list()`: nama, lokasi, tersedia atau tidak. Bisa dipanggil semua peran yang masuk; tanpa rentang hadiah. */
export async function fetchPosts(supabase: SupabaseClient<Database>): Promise<PostRow[] | null> {
  const { data, error } = await supabase.rpc("get_post_list");
  if (error || !data) return null;
  return buildPostRows(
    data.map((p) => ({ id: p.id, name: p.name, location: p.location, isOpen: p.is_open })),
  );
}
