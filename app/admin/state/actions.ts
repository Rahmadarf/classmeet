"use server";

import { z } from "zod";
import { mapRpcError } from "@/lib/errors";
import type { ActionResult } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";

const INVALID: ActionResult<never> = {
  ok: false,
  message: "Input tidak valid.",
  code: "invalid_input",
  retryable: false,
};

const stateSchema = z.object({ state: z.enum(["open", "paused", "finished"]) });
const visibleSchema = z.object({ visible: z.boolean() });

async function run(
  label: string,
  call: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<ActionResult> {
  const { error } = await call();
  if (error) {
    const mapped = mapRpcError(error);
    if (!mapped.code && !mapped.retryable) console.error(`[${label}] galat tak terduga:`, error.message);
    return { ok: false, ...mapped };
  }
  return { ok: true, data: undefined };
}

/**
 * Pindah status game (docs/04 §3.3): `open` (buka / lanjutkan), `paused` (tutup pasar harian), `finished` (akhiri;
 * tidak bisa dibatalkan). Peran dicek di proxy dan di dalam `admin_set_game_state`; urutan peralihan yang sah serta
 * penolakan bila masih ada berita live (`news_pending`) ditegakkan database.
 */
export async function setGameState(input: unknown): Promise<ActionResult> {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  return run("admin_set_game_state", () =>
    supabase.rpc("admin_set_game_state", { p_state: parsed.data.state }),
  );
}

export async function setLeaderboardVisible(input: unknown): Promise<ActionResult> {
  const parsed = visibleSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  return run("admin_set_leaderboard_visible", () =>
    supabase.rpc("admin_set_leaderboard_visible", { p_visible: parsed.data.visible }),
  );
}

export async function setLeaderboardFrozen(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ frozen: z.boolean() }).safeParse(input);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  return parsed.data.frozen
    ? run("admin_freeze_leaderboard", () => supabase.rpc("admin_freeze_leaderboard"))
    : run("admin_unfreeze_leaderboard", () => supabase.rpc("admin_unfreeze_leaderboard"));
}

/**
 * Reset game (`admin_reset_game`): kembalikan game ke keadaan sebelum dimulai. Saldo, transaksi, kepemilikan, hadiah pos,
 * dividen, riwayat harga, grafik IHAI, dan daftar berita dikosongkan; harga dan stok aset kembali ke awal; berita kembali ke
 * kumpulan; status `setup`. Tim, pos, aset, dan isi berita tetap. Tidak bisa dibatalkan.
 */
export async function resetGame(): Promise<ActionResult> {
  const supabase = await createClient();
  return run("admin_reset_game", () => supabase.rpc("admin_reset_game"));
}
