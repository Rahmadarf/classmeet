import { formatRupiah } from "@/lib/money";

/** Alasan tombol beli mati (dari `get_analysis_offer`); `ok` = bisa beli. */
export type AnalysisReason =
  "ok" | "market_closed" | "feature_disabled" | "no_live_news" | "window_closed" | "analysis_unavailable";

export type AnalysisOffer = {
  price: number;
  canBuy: boolean;
  reason: AnalysisReason;
  /** Tim ini sudah membeli laporan untuk berita yang sedang tayang. */
  owned: boolean;
  newsTitle: string | null;
};

/** Laporan yang sudah dibeli (salinan di `analysis_purchases`). */
export type AnalysisReport = {
  id: number;
  newsTitle: string;
  price: number;
  /** Tepat 4 paragraf: ringkasan, ciri naik, ciri turun, catatan. */
  paragraphs: string[];
  createdAt: string;
};

const REASONS: Record<Exclude<AnalysisReason, "ok">, string> = {
  market_closed: "Pasar sedang tutup.",
  feature_disabled: "Analisa sedang dimatikan panitia.",
  no_live_news: "Belum ada berita yang tayang. Analisa tersedia saat berita baru terbit.",
  window_closed: "Waktu membeli analisa untuk berita ini sudah habis. Tunggu berita berikutnya.",
  analysis_unavailable: "Laporan untuk berita ini belum tersedia.",
};

/**
 * Teks keadaan tombol "Beli analisa": alasan dari database, atau saldo kurang (dihitung di klien dari saldo terbaru).
 * `null` = tombol aktif. Pemilik laporan selalu boleh membukanya (tombol "Lihat laporan"), jadi tidak ada alasan.
 */
export function analysisBlockedText(offer: AnalysisOffer, cash: number | null): string | null {
  if (offer.owned) return null;
  if (!offer.canBuy && offer.reason !== "ok") return REASONS[offer.reason];
  if (cash !== null && cash < offer.price) {
    return `Saldo kurang ${formatRupiah(offer.price - cash)} untuk membeli analisa ini.`;
  }
  return null;
}

/** Judul tiap paragraf laporan (urutan tetap: 1 ringkasan, 2 naik, 3 turun, 4 catatan). */
export const ANALYSIS_SECTIONS = [
  { key: "summary", title: "Ringkasan" },
  { key: "up", title: "Ciri yang naik" },
  { key: "down", title: "Ciri yang turun" },
  { key: "notes", title: "Catatan" },
] as const;
