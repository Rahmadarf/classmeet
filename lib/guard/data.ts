import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/** Pos milik penjaga (satu penjaga = satu pos; `posts.guard_id`). */
export type MyPost = { id: string; name: string; location: string; open: boolean };

export async function fetchMyPost(supabase: Db, guardId: string): Promise<MyPost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id,name,location,is_open")
    .eq("guard_id", guardId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, location: data.location, open: data.is_open };
}

/**
 * "Pos 3 · Merakit Buta" → { number: "3", title: "Merakit Buta", label: "Pos 3" } (untuk eyebrow "POS 3");
 * "Lomba 2 · Futsal" → label "Lomba 2". Tanpa nomor: number dan label null.
 */
export function splitPostName(name: string): { number: string | null; title: string; label: string | null } {
  const m = /^(Pos|Lomba)\s*(\d{1,3})\s*[·\-–:]\s*(.+)$/i.exec(name.trim());
  if (!m) return { number: null, title: name.trim(), label: null };
  const number = String(Number(m[2]));
  return { number, title: m[3].trim(), label: `${/^lomba$/i.test(m[1]) ? "Lomba" : "Pos"} ${number}` };
}
