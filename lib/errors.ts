/**
 * Kode error RPC → pesan Indonesia ramah (docs/04-rpc-contracts.md §7).
 * Pesan SQL mentah TIDAK PERNAH ditampilkan ke pengguna.
 */
const MESSAGES: Record<string, string> = {
  forbidden: "Kamu tidak punya akses untuk aksi ini.",
  invalid_input: "Input tidak valid.",
  invalid_argument: "Input tidak valid.",
  market_closed: "Pasar sedang tutup.",
  game_not_active: "Permainan belum dimulai atau sudah selesai.",
  game_finished: "Permainan sudah selesai.",
  asset_not_found: "Aset tidak tersedia.",
  invalid_tick: "Harga harus kelipatan fraksi harga.",
  order_not_found: "Order tidak ditemukan.",
  order_not_open: "Order ini sudah tidak aktif.",
  insufficient_cash: "Saldo tidak cukup.",
  insufficient_holdings: "Jumlah aset yang kamu miliki tidak cukup.",
  request_id_conflict: "Permintaan bentrok, muat ulang halaman.",
  post_closed: "Pos sedang tidak tersedia.",
  invalid_amount: "Nominal tidak valid.",
  team_not_found: "Tim tidak ditemukan atau sudah dihapus.",
  news_not_found: "Berita tidak ditemukan.",
  news_wrong_status: "Berita ini tidak bisa diubah pada statusnya sekarang.",
  game_started_locked: "Game sudah dimulai. Harga, daftar aset, dan berita tidak bisa diubah lagi.",
  asset_suspended:
    "Aset ini sedang disuspensi sementara. Order baru belum bisa dipasang; order antre masih bisa dibatalkan.",
  bankruptcy_exists: "Aset ini sudah dipasang bangkrut di berita lain.",
  news_invalid_effects: "Efek berita tidak memenuhi aturan.",
  news_pending: "Masih ada berita yang belum selesai berjalan.",
  price_out_of_range: "Harga di luar batas yang diizinkan.",
  invalid_state_transition: "Perpindahan status tidak diizinkan.",
  leaderboard_hidden: "Leaderboard belum dibuka.",
  post_not_found: "Pos tidak ditemukan.",
  symbol_taken: "Kode aset sudah dipakai.",
  guard_invalid: "Penjaga tidak valid atau sudah memegang pos lain.",
  rate_limited: "Terlalu banyak permintaan, tunggu sebentar.",
};

export const GENERIC_ERROR = "Terjadi kesalahan, coba lagi.";

/** Error jaringan/transport: boleh diulang dengan `request_id` yang SAMA. */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; name?: string; code?: string };
  const text = `${e.name ?? ""} ${e.message ?? ""}`.toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("failed to fetch") ||
    text.includes("retryablefetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("timeout") ||
    text.includes("econnreset")
  );
}

/** Ambil kode (mis. `insufficient_cash`) dari error PostgREST dan petakan ke pesan ramah. */
export function mapRpcError(error: unknown): { code: string | null; message: string; retryable: boolean } {
  if (isNetworkError(error)) {
    return { code: null, message: "Koneksi bermasalah. Coba lagi.", retryable: true };
  }
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").trim()
      : "";
  const code = raw in MESSAGES ? raw : null;
  if (code) return { code, message: MESSAGES[code], retryable: false };
  // Error tak terduga: dicatat di log server oleh pemanggil; pengguna hanya melihat pesan umum.
  return { code: null, message: GENERIC_ERROR, retryable: false };
}
