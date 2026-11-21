import { formatRupiah } from "@/lib/money";

export type AuditRaw = {
  id: number;
  actorId: string | null;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
export type Lookup = {
  actors: Record<string, string>;
  teams: Record<string, string>;
  posts: Record<string, string>;
  /** Kode aset menurut id (untuk ringkasan stok). */
  assets?: Record<string, string>;
};

export type AuditCategory =
  "hadiah" | "koreksi" | "status" | "pos" | "berita" | "aset" | "perangkat" | "lainnya";

export const FILTERS: { key: "semua" | AuditCategory; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "hadiah", label: "Hadiah" },
  { key: "koreksi", label: "Koreksi saldo" },
  { key: "status", label: "Status game" },
  { key: "pos", label: "Pos" },
  { key: "berita", label: "Berita" },
  { key: "aset", label: "Aset" },
  { key: "perangkat", label: "Perangkat" },
];

/** Kategori menurut nama aksi (aksi yang benar-benar ditulis fungsi database; docs/04). */
export function categoryOf(action: string): AuditCategory {
  if (action === "payout_awarded") return "hadiah";
  if (action === "adjust_cash" || action === "rotate_qr" || action === "create_team") return "koreksi";
  if (["set_state", "reset_game", "leaderboard_visible", "freeze_leaderboard", "unfreeze_leaderboard"].includes(action))
    return "status";
  if (["guard_set_post_open", "set_post_open", "upsert_post", "create_guard"].includes(action)) return "pos";
  if (
    [
      "save_news",
      "set_news_ready",
      "news_launch_failed",
      "set_news_settings",
      "restart_news",
      "set_news_bankruptcy",
      "set_news_event",
    ].includes(action)
  )
    return "berita";
  if (
    [
      "upsert_asset",
      "set_stock",
      "set_trade_settings",
      "asset_bankrupt",
      "asset_bankrupt_failed",
      "asset_dividend",
      "asset_suspended",
      "asset_resumed",
      "asset_event_failed",
    ].includes(action)
  )
    return "aset";
  if (action.startsWith("kiosk_")) return "perangkat";
  return "lainnya";
}

export type AuditRow = {
  id: number;
  at: string;
  action: string;
  category: AuditCategory;
  actor: string;
  summary: string;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
/** Basis poin → persen dengan koma desimal: 200 → "2", 20 → "0,2". */
const pctText = (bps: number) => String(bps / 100).replace(".", ",");
const str = (v: unknown) => (typeof v === "string" ? v : "");
const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatRupiah(Math.abs(n))}`;

/** Ringkasan satu baris (dalam Bahasa Indonesia) dari payload log; isi bebas pengguna diperlakukan sebagai teks biasa. */
export function summarize(row: AuditRaw, lookup: Lookup): string {
  const p = row.payload;
  const team = lookup.teams[str(p.team_id)] ?? "tim";
  const post = lookup.posts[str(p.post_id)] ?? "pos";
  switch (row.action) {
    case "payout_awarded":
      return `${team} ${signed(num(p.amount))} dari ${post}`;
    case "adjust_cash":
      return `${team} ${signed(num(p.delta))} · alasan: ${str(p.reason)}`;
    case "create_team":
      return `Tim baru: ${str(p.name)} (${str(p.username)})`;
    case "create_guard":
      return `Penjaga baru: ${str(p.username)} + ${post}`;
    case "rotate_qr":
      return `${team}: kartu QR diganti`;
    case "set_state":
      return `Game: ${str(p.from)} → ${str(p.to)}`;
    case "leaderboard_visible":
      return p.visible === true
        ? "Leaderboard ditampilkan di layar publik"
        : "Leaderboard disembunyikan dari layar publik";
    case "freeze_leaderboard":
      return "Leaderboard dibekukan";
    case "unfreeze_leaderboard":
      return "Pembekuan leaderboard dilepas";
    case "guard_set_post_open":
      return `${post} ${p.is_open === true ? "jadi Tersedia" : "jadi Tidak tersedia"}`;
    case "save_news":
      return "Berita disimpan";
    case "set_news_ready":
      return p.ready === true ? "Berita ditandai siap" : "Berita dikeluarkan dari kumpulan";
    case "news_launch_failed":
      return "Peluncuran berita gagal (dicatat sistem)";
    case "set_post_open":
      return `${post} ${p.is_open === true ? "jadi Tersedia" : "jadi Tidak tersedia"} oleh admin`;
    case "upsert_post":
      return `${p.created === true ? "Pos baru" : "Pos diubah"}: ${str(p.name)}`;
    case "upsert_asset":
      return `${p.created === true ? "Aset baru" : "Aset diubah"}: ${str(p.symbol)}`;
    case "set_stock":
      return `Stok ${lookup.assets?.[str(p.asset_id)] ?? "aset"} ${num(p.before)} → ${num(p.after)} · alasan: ${str(p.reason)}`;
    case "set_trade_settings":
      return `Pengaturan toko diubah: selisih jual ${pctText(num(p.sell_spread_bps))} %, tekanan ${pctText(num(p.pressure_bps_per_unit))} % per unit, batas pegang ${num(p.hold_cap_pct)} %`;
    case "set_news_settings":
      return "Pengaturan berita diubah";
    case "reset_game":
      return `Game di-reset: saldo ${num(p.teams)} tim jadi Rp 0, ${num(p.transactions)} transaksi dan ${num(p.payouts)} hadiah pos dihapus, ${num(p.news_ready)} berita kembali ke kumpulan`;
    case "restart_news":
      return `Berita dimulai ulang: ${num(p.restored)} berita kembali ke kumpulan`;
    case "set_news_bankruptcy":
      return p.asset_id ? "Berita: aset bangkrut dipasang" : "Berita: aset bangkrut dilepas";
    case "asset_bankrupt": {
      const holders = Array.isArray(p.holders) ? p.holders.length : 0;
      return `${str(p.symbol)} bangkrut: ${num(p.orders_cancelled)} order dibatalkan, ${holders} tim dilikuidasi, total ${formatRupiah(num(p.total_paid))}`;
    }
    case "set_news_event": {
      const kind = str(p.kind) === "dividend" ? "dividen" : "suspensi";
      return p.amount === null || p.amount === undefined
        ? `Berita: event ${kind} dilepas`
        : `Berita: event ${kind} dipasang`;
    }
    case "asset_dividend":
      return `Dividen ${str(p.symbol)} ${formatRupiah(num(p.per_unit))} per unit, total ${formatRupiah(num(p.total_paid))}`;
    case "asset_suspended":
      return `${str(p.symbol)} disuspensi ${num(p.minutes)} menit`;
    case "asset_resumed":
      return `${str(p.symbol)} dibuka kembali`;
    case "asset_event_failed":
      return "Event aset gagal dijalankan (dicatat sistem)";
    case "asset_bankrupt_failed":
      return "Likuidasi aset bangkrut gagal (dicatat sistem)";
    case "kiosk_login":
    case "kiosk_logout":
    case "kiosk_idle_logout": {
      const what =
        row.action === "kiosk_login" ? "masuk" : row.action === "kiosk_logout" ? "keluar" : "keluar otomatis";
      const device = str(p.device);
      return `${lookup.actors[row.actorId ?? ""] ?? "Tim"} ${what}${device ? ` · ${device}` : ""}`;
    }
    default:
      return row.action;
  }
}

export function buildAuditRows(rows: AuditRaw[], lookup: Lookup): AuditRow[] {
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    action: r.action,
    category: categoryOf(r.action),
    actor: r.actorId ? (lookup.actors[r.actorId] ?? "—") : "sistem",
    summary: summarize(r, lookup),
  }));
}
