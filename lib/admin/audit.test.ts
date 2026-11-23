import { describe, expect, it } from "vitest";
import { buildAuditRows, categoryOf } from "./audit";

const lookup = {
  actors: { a1: "guard1 · Alya", ad: "admin1" },
  teams: { t1: "Tim Elang" },
  posts: { p1: "Pos 3 · Merakit" },
};
const row = (action: string, payload: Record<string, unknown>, actorId: string | null = "a1") => ({
  id: 1,
  actorId,
  action,
  payload,
  createdAt: "2026-11-18T01:00:00Z",
});

describe("categoryOf", () => {
  it("memetakan aksi ke kategori", () => {
    expect(categoryOf("payout_awarded")).toBe("hadiah");
    expect(categoryOf("adjust_cash")).toBe("koreksi");
    expect(categoryOf("set_state")).toBe("status");
    expect(categoryOf("freeze_leaderboard")).toBe("status");
    expect(categoryOf("guard_set_post_open")).toBe("pos");
    expect(categoryOf("set_news_ready")).toBe("berita");
    expect(categoryOf("restart_news")).toBe("berita");
    expect(categoryOf("reset_game")).toBe("status");
    expect(categoryOf("kiosk_idle_logout")).toBe("perangkat");
    expect(categoryOf("aneh")).toBe("lainnya");
  });
});

describe("buildAuditRows", () => {
  it("meringkas hadiah dan koreksi saldo dengan tanda dan nama", () => {
    const [a, b] = buildAuditRows(
      [
        row("payout_awarded", { team_id: "t1", post_id: "p1", amount: 300000 }),
        row("adjust_cash", { team_id: "t1", delta: -100000, reason: "salah ketik" }, "ad"),
      ],
      lookup,
    );
    expect(a.summary).toBe("Tim Elang +Rp 300.000 dari Pos 3 · Merakit");
    expect(a.actor).toBe("guard1 · Alya");
    expect(b.summary).toBe("Tim Elang −Rp 100.000 · alasan: salah ketik");
  });

  it("status, pos, dan perangkat", () => {
    const rows = buildAuditRows(
      [
        row("set_state", { from: "paused", to: "open" }, "ad"),
        row("guard_set_post_open", { post_id: "p1", is_open: false }),
        row("kiosk_login", { device: "laptop-3" }, "a1"),
      ],
      lookup,
    );
    expect(rows.map((r) => r.summary)).toEqual([
      "Game: paused → open",
      "Pos 3 · Merakit jadi Tidak tersedia",
      "guard1 · Alya masuk · laptop-3",
    ]);
  });

  it("pelaku kosong = sistem; aksi tak dikenal memakai nama aksi", () => {
    const [r] = buildAuditRows([row("baru_sekali", {}, null)], lookup);
    expect(r).toMatchObject({ actor: "sistem", summary: "baru_sekali", category: "lainnya" });
  });
});

describe("aksi dari fungsi admin baru (scripts/sql/admin-functions-missing.sql)", () => {
  const lk = { ...lookup, assets: { a1: "AP" } };
  it("kategori dan ringkasan", () => {
    expect(categoryOf("set_post_open")).toBe("pos");
    expect(categoryOf("upsert_post")).toBe("pos");
    expect(categoryOf("upsert_asset")).toBe("aset");
    expect(categoryOf("set_stock")).toBe("aset");
    expect(categoryOf("set_news_settings")).toBe("berita");
    const rows = buildAuditRows(
      [
        row("set_stock", { asset_id: "a1", before: 10, after: 7, reason: "koreksi" }, "ad"),
        row("set_post_open", { post_id: "p1", is_open: true }, "ad"),
        row("upsert_asset", { symbol: "AP", created: true }, "ad"),
      ],
      lk,
    );
    expect(rows.map((r) => r.summary)).toEqual([
      "Stok AP 10 → 7 · alasan: koreksi",
      "Pos 3 · Merakit jadi Tersedia oleh admin",
      "Aset baru: AP",
    ]);
  });

  it("lihat QR tim: kategori koreksi dan ringkasan", () => {
    expect(categoryOf("view_team_qr")).toBe("koreksi");
    const [a] = buildAuditRows([row("view_team_qr", { team_id: "t1" }, "ad")], lookup);
    expect(a.summary).toMatch(/kartu QR dilihat$/);
  });

  it("pengaturan Analisa Pasar: kategori aset dan ringkasan", () => {
    expect(categoryOf("set_analysis_settings")).toBe("aset");
    const [a, b] = buildAuditRows(
      [
        row("set_analysis_settings", { price: 200000, enabled: true }, "ad"),
        row("set_analysis_settings", { price: 0, enabled: false }, "ad"),
      ],
      lookup,
    );
    expect([a.summary, b.summary]).toEqual([
      "Analisa Pasar aktif, harga Rp 200.000",
      "Analisa Pasar dimatikan, harga Rp 0",
    ]);
  });

  it("pengaturan toko: kategori aset dan ringkasan", () => {
    expect(categoryOf("set_trade_settings")).toBe("aset");
    const [r] = buildAuditRows(
      [
        row(
          "set_trade_settings",
          {
            sell_spread_bps: 200,
            pressure_bps_per_unit: 20,
            pressure_cap_bps: 1500,
            pressure_decay_minutes: 10,
            hold_cap_pct: 30,
          },
          "ad",
        ),
      ],
      lookup,
    );
    expect(r.summary).toBe(
      "Pengaturan toko diubah: selisih jual 2 %, tekanan 0,2 % per unit, batas pegang 30 %",
    );
  });

  it("event aset bangkrut", () => {
    expect(categoryOf("asset_bankrupt")).toBe("aset");
    expect(categoryOf("set_news_bankruptcy")).toBe("berita");
    const [r] = buildAuditRows(
      [
        row(
          "asset_bankrupt",
          { symbol: "AP", orders_cancelled: 12, total_paid: 216900, holders: [{ team_id: "t1" }] },
          null,
        ),
      ],
      lk,
    );
    expect(r.summary).toBe("AP bangkrut: 12 order dibatalkan, 1 tim dilikuidasi, total Rp 216.900");
  });

  it("event dividen dan suspensi", () => {
    expect(categoryOf("asset_dividend")).toBe("aset");
    expect(categoryOf("asset_suspended")).toBe("aset");
    expect(categoryOf("set_news_event")).toBe("berita");
    const rows = buildAuditRows(
      [
        row("asset_dividend", { symbol: "AP", per_unit: 36170, total_paid: 108510 }, null),
        row("asset_suspended", { symbol: "AD", minutes: 10 }, null),
        row("asset_resumed", { symbol: "AD" }, null),
      ],
      lk,
    );
    expect(rows.map((r) => r.summary)).toEqual([
      "Dividen AP Rp 36.170 per unit, total Rp 108.510",
      "AD disuspensi 10 menit",
      "AD dibuka kembali",
    ]);
  });
});
