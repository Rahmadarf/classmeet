import { describe, expect, it } from "vitest";
import { analysisBlockedText, ANALYSIS_SECTIONS, type AnalysisOffer } from "./view";

const offer = (o: Partial<AnalysisOffer> = {}): AnalysisOffer => ({
  price: 200_000,
  canBuy: true,
  reason: "ok",
  owned: false,
  newsTitle: "Harga minyak naik",
  ...o,
});

describe("analysisBlockedText", () => {
  it("bisa beli: tidak ada alasan", () => {
    expect(analysisBlockedText(offer(), 500_000)).toBeNull();
    expect(analysisBlockedText(offer(), 200_000)).toBeNull();
  });

  it("alasan dari database dipetakan ke teks Indonesia", () => {
    expect(analysisBlockedText(offer({ canBuy: false, reason: "market_closed" }), 1)).toBe(
      "Pasar sedang tutup.",
    );
    expect(analysisBlockedText(offer({ canBuy: false, reason: "no_live_news" }), 1_000_000)).toMatch(
      /Belum ada berita/,
    );
    expect(analysisBlockedText(offer({ canBuy: false, reason: "window_closed" }), 1_000_000)).toMatch(
      /sudah habis/,
    );
    expect(analysisBlockedText(offer({ canBuy: false, reason: "feature_disabled" }), 1_000_000)).toMatch(
      /dimatikan/,
    );
    expect(analysisBlockedText(offer({ canBuy: false, reason: "analysis_unavailable" }), 1_000_000)).toMatch(
      /belum tersedia/,
    );
  });

  it("saldo kurang: menyebut selisihnya; saldo belum diketahui tidak menghalangi", () => {
    expect(analysisBlockedText(offer(), 150_000)).toContain("Rp 50.000");
    expect(analysisBlockedText(offer(), null)).toBeNull();
  });

  it("pemilik laporan tidak pernah terhalang (boleh membuka laporan)", () => {
    expect(analysisBlockedText(offer({ owned: true, canBuy: false, reason: "window_closed" }), 0)).toBeNull();
  });
});

describe("ANALYSIS_SECTIONS", () => {
  it("empat bagian dalam urutan tetap", () => {
    expect(ANALYSIS_SECTIONS.map((s) => s.key)).toEqual(["summary", "up", "down", "notes"]);
  });
});
