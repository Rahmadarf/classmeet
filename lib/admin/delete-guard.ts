import type { GameState } from "@/lib/admin/state";

/**
 * Hapus tim dan hapus pos hanya boleh saat status game `setup` (ditegakkan database: `game_not_setup`). Fungsi murni ini
 * dipakai UI untuk memblokir tombol dan menjelaskan alasannya; database tetap penjaga sebenarnya.
 */
export function canDeleteInState(state: GameState): boolean {
  return state === "setup";
}

const STATE_LABEL: Record<GameState, string> = {
  setup: "Setup",
  open: "Open",
  paused: "Paused",
  finished: "Finished",
};

/** Alasan tombol hapus diblokir (teks bantu/tooltip), atau null bila boleh. `kind`: yang akan dihapus. */
export function deleteBlockedReason(state: GameState, kind: "tim" | "pos"): string | null {
  if (canDeleteInState(state)) return null;
  return `Hapus ${kind} hanya bisa saat status game Setup. Status sekarang: ${STATE_LABEL[state]}. Reset game dari halaman Status Game untuk kembali ke Setup.`;
}
