import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { dayKeyWib } from "@/lib/money";

type Db = SupabaseClient<Database>;

export type GameState = Database["public"]["Enums"]["game_state"];

export type AdminGame = {
  state: GameState;
  startedAt: string | null;
  leaderboardVisible: boolean;
  /** Waktu pembekuan; null bila tidak beku. */
  frozenAt: string | null;
};

export type NewsPool = {
  draft: number;
  ready: number;
  eligible: number;
  live: number;
  applied: number;
};

export async function fetchAdminGame(supabase: Db): Promise<AdminGame | null> {
  const { data, error } = await supabase
    .from("game_settings")
    .select("state,started_at,leaderboard_visible,leaderboard_frozen_at")
    .maybeSingle();
  if (error || !data) return null;
  return {
    state: data.state,
    startedAt: data.started_at,
    leaderboardVisible: data.leaderboard_visible,
    frozenAt: data.leaderboard_frozen_at,
  };
}

/** `get_news_pool_status()`: HANYA jumlah. Isi dan urutan berita tidak pernah terbaca admin (docs/07 §3.7). */
export async function fetchNewsPool(supabase: Db): Promise<NewsPool | null> {
  const { data, error } = await supabase.rpc("get_news_pool_status");
  const row = data?.[0];
  if (error || !row) return null;
  return {
    draft: row.draft_count,
    ready: row.ready_count,
    eligible: row.eligible_count,
    live: row.live_count,
    applied: row.applied_count,
  };
}

/** "Hari ke-N" = selisih hari kalender WIB sejak pasar pertama dibuka (+1). null bila belum dibuka. */
export function gameDay(startedAt: string | null, nowMs: number): number | null {
  if (!startedAt) return null;
  const toUtcDay = (key: string) => Date.parse(`${key}T00:00:00Z`);
  const diff = Math.round((toUtcDay(dayKeyWib(nowMs)) - toUtcDay(dayKeyWib(startedAt))) / 86_400_000);
  return diff + 1;
}

export type PoolWarning = { level: "warn" | "bad"; text: string } | null;

/**
 * Peringatan kumpulan berita (docs/07 §3.7): kuning bila "boleh terbit" ≤ 6 (± dua jam), merah bila 0 saat pasar
 * buka (harga berhenti berubah). Hanya bermakna saat game berjalan (buka atau dijeda).
 */
export function poolWarning(state: GameState, pool: NewsPool): PoolWarning {
  if (state === "setup" || state === "finished") return null;
  if (pool.eligible === 0) {
    return {
      level: state === "open" ? "bad" : "warn",
      text: "Tidak ada berita yang boleh terbit. Kumpulan terkunci sejak game dibuka; harga berhenti berubah.",
    };
  }
  if (pool.eligible <= 6) {
    return {
      level: "warn",
      text: `Boleh terbit tinggal ${pool.eligible}. Kumpulan terkunci sejak game dibuka; bila habis, harga berhenti berubah.`,
    };
  }
  return null;
}
