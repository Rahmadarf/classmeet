import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildAuditRows, type AuditRow, type Lookup } from "./audit";
import { buildPayoutRows, totalsBy, type PayoutRow } from "./payouts";
import { postNumber } from "@/lib/history/view";
import { postTitle } from "@/lib/posts/view";
import { fetchNews, type NewsItem } from "@/lib/team/data";
import { fetchNewsPool, type NewsPool } from "./state";
import { buildTransactionsPage, type TransactionsPage } from "./transactions";

type Db = SupabaseClient<Database>;

/** Nama tim, pos, dan akun (RLS: admin membaca semuanya). Gagal salah satu → null. */
async function fetchDirectory(supabase: Db) {
  const [teams, posts, profiles] = await Promise.all([
    supabase.from("teams").select("id,name,cash"),
    supabase.from("posts").select("id,name,location,guard_id,is_open,kind"),
    supabase.from("profiles").select("id,username,display_name,role"),
  ]);
  if (teams.error || !teams.data || posts.error || !posts.data || profiles.error || !profiles.data)
    return null;
  return { teams: teams.data, posts: posts.data, profiles: profiles.data };
}

const nameOf = (p: { username: string; display_name: string | null }) => p.display_name || p.username;

// ---------- Hadiah ----------
export type PayoutsPage = {
  rows: PayoutRow[];
  perPost: { name: string; total: number }[];
  perTeam: { name: string; total: number }[];
  teams: { id: string; name: string; cash: number }[];
};

export async function fetchPayoutsPage(supabase: Db): Promise<PayoutsPage | null> {
  const [dir, payouts] = await Promise.all([
    fetchDirectory(supabase),
    supabase
      .from("payouts")
      .select("id,team_id,post_id,guard_id,amount,note,created_at")
      .order("id", { ascending: false })
      .limit(1000),
  ]);
  if (!dir || payouts.error || !payouts.data) return null;
  const teams = Object.fromEntries(dir.teams.map((t) => [t.id, t.name]));
  const posts = Object.fromEntries(dir.posts.map((p) => [p.id, p.name]));
  const guards = Object.fromEntries(dir.profiles.map((p) => [p.id, nameOf(p)]));
  const raw = payouts.data.map((p) => ({
    id: p.id,
    teamId: p.team_id,
    postId: p.post_id,
    guardId: p.guard_id,
    amount: p.amount,
    note: p.note,
    createdAt: p.created_at,
  }));
  const all = buildPayoutRows(raw, teams, posts, guards);
  return {
    rows: all.slice(0, 100),
    perPost: totalsBy(
      raw,
      (p) => p.postId,
      (p) => p.amount,
    ).map((t) => ({ name: posts[t.key] ?? "Pos", total: t.total })),
    perTeam: totalsBy(
      raw,
      (p) => p.teamId,
      (p) => p.amount,
    ).map((t) => ({ name: teams[t.key] ?? "Tim", total: t.total })),
    teams: dir.teams
      .map((t) => ({ id: t.id, name: t.name, cash: t.cash }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------- Tim ----------
export type TeamRow = {
  teamId: string;
  rank: number;
  name: string;
  cash: number;
  holdings: number;
  total: number;
  freeCash: number;
  /** Jumlah anggota tim (`admin_member_counts`); 0 bila belum ada atau fungsinya belum dimuat di database. */
  members: number;
};

export async function fetchTeamsPage(supabase: Db): Promise<TeamRow[] | null> {
  const [board, teams, counts] = await Promise.all([
    supabase.rpc("get_leaderboard"),
    supabase.from("teams").select("id,name,cash"),
    supabase.rpc("admin_member_counts"),
  ]);
  if (board.error || !board.data || teams.error || !teams.data) return null;
  const free = new Map(teams.data.map((t) => [t.id, t.cash]));
  // Jumlah anggota tidak wajib: bila gagal dimuat, halaman Tim tetap tampil (kolom Anggota = 0).
  const memberCount = new Map((counts.data ?? []).map((c) => [c.team_id, c.member_count]));
  return board.data
    .flatMap((r): TeamRow[] =>
      r.team_id && r.team_name && r.rank !== null && r.net_worth !== null
        ? [
            {
              teamId: r.team_id,
              rank: r.rank,
              name: r.team_name,
              cash: r.cash ?? 0,
              holdings: r.holdings_value ?? 0,
              total: r.net_worth,
              freeCash: free.get(r.team_id) ?? 0,
              members: memberCount.get(r.team_id) ?? 0,
            },
          ]
        : [],
    )
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

// ---------- Anggota tim ----------
export type TeamMember = { id: number; name: string; className: string | null; captain: boolean };

/** Anggota satu tim (RLS: hanya admin). Ketua di atas, lalu menurut nama. null bila gagal dimuat. */
export async function fetchTeamMembers(supabase: Db, teamId: string): Promise<TeamMember[] | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id,name,class_name,is_captain")
    .eq("team_id", teamId)
    .order("is_captain", { ascending: false })
    .order("name", { ascending: true });
  if (error || !data) return null;
  return data.map((m) => ({ id: m.id, name: m.name, className: m.class_name, captain: m.is_captain }));
}

/** Nama dan jumlah anggota semua tim, untuk pratinjau impor (mencocokkan nama tim berkas dengan tim yang ada). */
export async function fetchTeamsForImport(
  supabase: Db,
): Promise<{ id: string; name: string; members: number }[] | null> {
  const [teams, counts] = await Promise.all([
    supabase.from("teams").select("id,name"),
    supabase.rpc("admin_member_counts"),
  ]);
  if (teams.error || !teams.data) return null;
  const memberCount = new Map((counts.data ?? []).map((c) => [c.team_id, c.member_count]));
  return teams.data.map((t) => ({ id: t.id, name: t.name, members: memberCount.get(t.id) ?? 0 }));
}

// ---------- Aset ----------
export type AdminAsset = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  lastPrice: number | null;
  min: number;
  max: number;
  /** Sisa stok pasar dan stok awal (`init_stock`; null sebelum pasar pertama dibuka). */
  stock: number;
  initStock: number | null;
  /** Tekanan stok (bps). */
  factorBps: number;
  active: boolean;
};

export async function fetchAssetsPage(supabase: Db): Promise<AdminAsset[] | null> {
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id,symbol,name,sector,price,last_price,min_price,max_price,stock,init_stock,price_factor_bps,is_active",
    )
    .order("symbol");
  if (error || !data) return null;
  return data.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    sector: a.sector,
    price: a.price,
    lastPrice: a.last_price,
    min: a.min_price,
    max: a.max_price,
    stock: a.stock,
    initStock: a.init_stock,
    factorBps: a.price_factor_bps,
    active: a.is_active,
  }));
}

// ---------- Pos ----------
export type AdminPost = {
  id: string;
  number: string | null;
  title: string;
  location: string;
  guard: string;
  total: number;
  open: boolean;
  /** `rally` = pos dengan penjaga; `lomba` = lomba dengan PIC (tanpa saklar buka/tutup). */
  kind: "rally" | "lomba";
};

export async function fetchPostsPage(supabase: Db): Promise<AdminPost[] | null> {
  const [dir, payouts] = await Promise.all([
    fetchDirectory(supabase),
    supabase.from("payouts").select("post_id,amount"),
  ]);
  if (!dir || payouts.error || !payouts.data) return null;
  const totals = new Map<string, number>();
  for (const p of payouts.data) totals.set(p.post_id, (totals.get(p.post_id) ?? 0) + p.amount);
  const guards = Object.fromEntries(dir.profiles.map((p) => [p.id, nameOf(p)]));
  return dir.posts
    .map((p) => ({
      id: p.id,
      number: postNumber(p.name),
      title: postTitle(p.name),
      location: p.location,
      guard: p.guard_id ? (guards[p.guard_id] ?? "—") : "—",
      total: totals.get(p.id) ?? 0,
      open: p.is_open,
      kind: p.kind === "lomba" ? ("lomba" as const) : ("rally" as const),
    }))
    .sort((a, b) =>
      a.number && b.number
        ? Number(a.number) - Number(b.number)
        : a.number
          ? -1
          : b.number
            ? 1
            : a.title.localeCompare(b.title),
    );
}

// ---------- Audit ----------
export async function fetchAuditPage(supabase: Db): Promise<AuditRow[] | null> {
  const [dir, log, assets] = await Promise.all([
    fetchDirectory(supabase),
    supabase
      .from("audit_log")
      .select("id,actor_id,action,payload,created_at")
      .order("id", { ascending: false })
      .limit(100),
    supabase.from("assets").select("id,symbol"),
  ]);
  if (!dir || log.error || !log.data) return null;
  const lookup: Lookup = {
    actors: Object.fromEntries(
      dir.profiles.map((p) => [
        p.id,
        p.display_name && p.display_name !== p.username ? `${p.username} · ${p.display_name}` : p.username,
      ]),
    ),
    teams: Object.fromEntries(dir.teams.map((t) => [t.id, t.name])),
    posts: Object.fromEntries(dir.posts.map((p) => [p.id, p.name])),
    assets: Object.fromEntries((assets.data ?? []).map((a) => [a.id, a.symbol])),
  };
  return buildAuditRows(
    log.data.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      action: r.action,
      payload: (r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? r.payload
        : {}) as Record<string, unknown>,
      createdAt: r.created_at,
    })),
    lookup,
  );
}

// ---------- Berita ----------
export type NewsDraft = {
  id: string;
  title: string;
  status: string;
  assets: number;
  /** Aset yang bangkrut di berita ini (event), bila ada. */
  bankruptcy: { assetId: string; symbol: string; name: string; pct: number } | null;
  /** Event dividen/suspensi pada berita ini. `amount`: persen harga acuan (dividen) atau menit (suspensi). */
  events: { assetId: string; symbol: string; name: string; kind: "dividend" | "suspend"; amount: number }[];
};
/** Aset aktif yang boleh dipilih sebagai aset bangkrut. */
export type NewsAssetOption = { id: string; symbol: string; name: string };
/** Efek berita yang sedang tampil (`admin_current_news_effects`): persen per aset dan event; TANPA waktu berlakunya. */
export type CurrentNewsEffects = {
  /** `live` = belum berlaku; `applied` = sudah berlaku. */
  status: "live" | "applied";
  effects: { symbol: string; name: string; pct: number }[];
  events: { kind: "bankrupt" | "dividend" | "suspend"; symbol: string; name: string; value: number }[];
};

/** Satu berita yang sudah berlaku (`admin_applied_news`): hanya yang sudah diterapkan ke harga; tanpa waktu yang belum terjadi. */
export type AppliedNews = {
  id: string;
  title: string;
  publishedAt: string | null;
  appliedAt: string | null;
  assets: number;
  event: { kind: "bankrupt" | "dividend" | "suspend"; symbol: string } | null;
};

/** Jumlah berita siap per jenis event (`get_news_pool_kinds`): hanya angka, boleh dilihat kapan saja. */
export type PoolKindCount = { kind: "price" | "bankrupt" | "suspend" | "dividend"; ready: number };
/** Cakupan event per aset (`news_pool_coverage`): HANYA sebelum game dibuka (sesudahnya database menolak). */
export type PoolCoverageRow = { symbol: string; bankrupt: number; suspend: number; dividend: number };
export type NewsPage = {
  locked: boolean;
  current: NewsItem | null;
  pool: NewsPool | null;
  kinds: PoolKindCount[] | null;
  currentEffects: CurrentNewsEffects | null;
  applied: AppliedNews[] | null;
  coverage: PoolCoverageRow[] | null;
  drafts: NewsDraft[];
  assets: NewsAssetOption[];
};

/**
 * Setelah game dibuka `news` dan `news_effects` TIDAK terbaca admin (RLS), jadi hanya jumlah (`get_news_pool_status`)
 * dan berita yang sudah tayang (`news_feed`) yang dimuat. Sebelum dibuka: daftar berita dengan jumlah aset terkena.
 */
export async function fetchNewsPage(supabase: Db, locked: boolean): Promise<NewsPage | null> {
  const [news, pool, kindRes, effRes, appliedRes] = await Promise.all([
    fetchNews(supabase, 1),
    fetchNewsPool(supabase),
    supabase.rpc("get_news_pool_kinds"),
    supabase.rpc("admin_current_news_effects"),
    supabase.rpc("admin_applied_news", { p_limit: 200 }),
  ]);
  if (!news) return null;
  const kinds: PoolKindCount[] | null =
    kindRes.error || !kindRes.data
      ? null
      : kindRes.data.flatMap((k): PoolKindCount[] =>
          k.kind === "price" || k.kind === "bankrupt" || k.kind === "suspend" || k.kind === "dividend"
            ? [{ kind: k.kind, ready: k.ready_count }]
            : [],
        );
  const applied: AppliedNews[] | null =
    appliedRes.error || !appliedRes.data
      ? null
      : appliedRes.data.map((r) => ({
          id: r.news_id,
          title: r.title,
          publishedAt: r.published_at,
          appliedAt: r.applied_at,
          assets: r.n_assets,
          event:
            r.event_symbol &&
            (r.event_kind === "bankrupt" || r.event_kind === "dividend" || r.event_kind === "suspend")
              ? { kind: r.event_kind, symbol: r.event_symbol }
              : null,
        }));
  let currentEffects: CurrentNewsEffects | null = null;
  if (!effRes.error && effRes.data && effRes.data.length > 0) {
    const status = effRes.data[0].status === "live" ? "live" : "applied";
    currentEffects = {
      status,
      effects: effRes.data
        .filter((r) => r.kind === "effect")
        .map((r) => ({ symbol: r.symbol, name: r.name, pct: r.value / 100 })),
      events: effRes.data.flatMap((r): CurrentNewsEffects["events"] =>
        r.kind === "bankrupt" || r.kind === "dividend" || r.kind === "suspend"
          ? [{ kind: r.kind, symbol: r.symbol, name: r.name, value: r.value }]
          : [],
      ),
    };
  }
  let coverage: PoolCoverageRow[] | null = null;
  let drafts: NewsDraft[] = [];
  let assets: NewsAssetOption[] = [];
  if (!locked) {
    const [list, bank, assetRows, evRows, covRes] = await Promise.all([
      // jumlah efek per berita lewat agregat tertanam (tidak terkena batas 1000 baris PostgREST)
      supabase
        .from("news")
        .select("id,title,status,news_effects(count)")
        .order("created_at", { ascending: false })
        .limit(1000), // batas baris PostgREST (1000); kumpulan v2 = 1000 berita
      supabase.from("news_bankruptcies").select("news_id,asset_id,liquidation_bps"),
      supabase.from("assets").select("id,symbol,name,is_active").order("symbol"),
      supabase.from("news_events").select("news_id,asset_id,kind,amount"),
      supabase.rpc("news_pool_coverage"),
    ]);
    if (
      list.error ||
      !list.data ||
      bank.error ||
      !bank.data ||
      assetRows.error ||
      !assetRows.data ||
      evRows.error ||
      !evRows.data
    )
      return null;
    const byId = new Map(assetRows.data.map((a) => [a.id, a]));
    const banks = new Map(bank.data.map((b) => [b.news_id, b]));
    const eventsOf = new Map<string, NewsDraft["events"]>();
    for (const e of evRows.data) {
      const a = byId.get(e.asset_id);
      if (!a || (e.kind !== "dividend" && e.kind !== "suspend")) continue;
      const arr = eventsOf.get(e.news_id) ?? [];
      arr.push({
        assetId: a.id,
        symbol: a.symbol,
        name: a.name,
        kind: e.kind,
        amount: e.kind === "dividend" ? e.amount / 100 : e.amount,
      });
      eventsOf.set(e.news_id, arr);
    }
    assets = assetRows.data
      .filter((a) => a.is_active)
      .map((a) => ({ id: a.id, symbol: a.symbol, name: a.name }));
    if (!covRes.error && covRes.data)
      coverage = covRes.data.map((c) => ({
        symbol: c.symbol,
        bankrupt: c.bankrupt,
        suspend: c.suspend,
        dividend: c.dividend,
      }));
    drafts = list.data.map((n) => ({
      id: n.id,
      title: n.title,
      status: n.status,
      assets: n.news_effects[0]?.count ?? 0,
      events: eventsOf.get(n.id) ?? [],
      bankruptcy: (() => {
        const b = banks.get(n.id);
        const a = b ? byId.get(b.asset_id) : undefined;
        return b && a
          ? { assetId: a.id, symbol: a.symbol, name: a.name, pct: b.liquidation_bps / 100 }
          : null;
      })(),
    }));
  }
  return { locked, current: news[0] ?? null, pool, kinds, currentEffects, applied, coverage, drafts, assets };
}

// ---------- Toko (model trading, docs/17) ----------
export type TradeSettings = {
  sellSpreadBps: number;
  pressureBpsPerUnit: number;
  pressureCapBps: number;
  pressureDecayMinutes: number;
  holdCapPct: number;
  stockMidPct: number;
  stockLowPct: number;
};

export async function fetchTradeSettings(supabase: Db): Promise<TradeSettings | null> {
  const { data, error } = await supabase
    .from("game_settings")
    .select(
      "sell_spread_bps,pressure_bps_per_unit,pressure_cap_bps,pressure_decay_minutes,hold_cap_pct,stock_mid_pct,stock_low_pct",
    )
    .maybeSingle();
  if (error || !data) return null;
  return {
    sellSpreadBps: data.sell_spread_bps,
    pressureBpsPerUnit: data.pressure_bps_per_unit,
    pressureCapBps: data.pressure_cap_bps,
    pressureDecayMinutes: data.pressure_decay_minutes,
    holdCapPct: data.hold_cap_pct,
    stockMidPct: data.stock_mid_pct,
    stockLowPct: data.stock_low_pct,
  };
}

/** Harga dan saklar Analisa Pasar (pay to win); boleh diubah kapan saja. */
export type AnalysisSettings = { price: number; enabled: boolean };

export async function fetchAnalysisSettings(supabase: Db): Promise<AnalysisSettings | null> {
  const { data, error } = await supabase
    .from("game_settings")
    .select("analysis_price,analysis_enabled")
    .maybeSingle();
  if (error || !data) return null;
  return { price: data.analysis_price, enabled: data.analysis_enabled };
}

/** Log pembelian Analisa Pasar untuk admin: TANPA isi laporan (isinya membocorkan efek berita). */
export type AnalysisLog = {
  purchases: number;
  buyers: number;
  revenue: number;
  rows: { id: number; at: string; teamName: string; newsTitle: string; price: number }[];
};

const ANALYSIS_LOG_LIMIT = 50;

export async function fetchAnalysisLog(supabase: Db): Promise<AnalysisLog | null> {
  const [summary, log] = await Promise.all([
    supabase.rpc("admin_analysis_summary"),
    supabase.rpc("admin_analysis_log", { p_limit: ANALYSIS_LOG_LIMIT }),
  ]);
  const s = summary.data?.[0];
  if (summary.error || !s || log.error || !log.data) return null;
  return {
    purchases: Number(s.purchases),
    buyers: Number(s.buyers),
    revenue: Number(s.revenue),
    rows: log.data.map((r) => ({
      id: r.id,
      at: r.created_at,
      teamName: r.team_name,
      newsTitle: r.news_title,
      price: r.price,
    })),
  };
}

const TX_LIST_LIMIT = 100;

/** Halaman Transaksi: 100 transaksi terbaru + ringkasan per aset dari seluruh transaksi (RLS: admin membaca semuanya). */
export async function fetchTransactionsPage(supabase: Db): Promise<TransactionsPage | null> {
  const [txs, summary, teams, assets, settings] = await Promise.all([
    supabase
      .from("transactions")
      .select("id,team_id,asset_id,side,qty,unit_price,total,created_at")
      .order("id", { ascending: false })
      .limit(TX_LIST_LIMIT),
    supabase.rpc("admin_transaction_summary"),
    supabase.from("teams").select("id,name"),
    supabase.from("assets").select("id,symbol,name,stock,init_stock,price_factor_bps").eq("is_active", true),
    fetchTradeSettings(supabase),
  ]);
  if (txs.error || !txs.data || summary.error || !summary.data || teams.error || !teams.data) return null;
  if (assets.error || !assets.data) return null;
  return buildTransactionsPage(
    txs.data.map((t) => ({
      id: t.id,
      teamId: t.team_id,
      assetId: t.asset_id,
      side: t.side,
      qty: t.qty,
      unitPrice: t.unit_price,
      total: t.total,
      createdAt: t.created_at,
    })),
    summary.data.map((s) => ({
      assetId: s.asset_id,
      bought: s.bought,
      sold: s.sold,
      volume: s.volume,
      n: s.n,
    })),
    Object.fromEntries(teams.data.map((t) => [t.id, t.name])),
    assets.data.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      stock: a.stock,
      initStock: a.init_stock ?? a.stock,
      factorBps: a.price_factor_bps,
    })),
    settings?.stockMidPct,
    settings?.stockLowPct,
  );
}
