/**
 * Uji beban ringan (meniru klien sungguhan). Dijalankan LOKAL terhadap Supabase uji; memakai akun seed
 * (scripts/.seed-output.local.json, tidak dicetak) dan butuh game berstatus `open` serta saldo tim > 0.
 *
 *   node --env-file=.env.local scripts/load-test.mjs [--clients 30] [--seconds 180] [--displays 2] [--url http://localhost:8000] [--spike]
 *
 * Tiap klien tim meniru aplikasi: polling pasar 5 dtk (ringkasan pasar, aset, game_settings, kepemilikan, aset bangkrut,
 * harga pembuka), saldo 10 dtk, berita 30 dtk, satu koneksi Realtime, dan beli/jual acak 1 unit tiap ±20 dtk.
 * Klien display: peringkat, indeks, aset, transaksi terakhir tiap 5 dtk. `--spike`: di tengah uji semua klien tim membeli
 * aset yang sama dan membeli Analisa Pasar bersamaan (hanya satu pembelian per tim yang boleh terjadi). Hasil: median / p95 / maks (ms) dan jumlah galat per jenis panggilan.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : (process.argv[i + 1] ?? def);
};
const CLIENTS = Number(arg("clients", 30));
const SECONDS = Number(arg("seconds", 180));
const DISPLAYS = Number(arg("displays", 2));
const SPIKE = process.argv.includes("--spike");
const URL_ = arg("url", "http://localhost:8000");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!KEY) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY kosong (jalankan dengan --env-file=.env.local)");

const seed = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), ".seed-output.local.json"), "utf8"),
);
const stats = new Map();
const T0 = performance.now();
const slow = new Map(); // detik ke-N (kelipatan 10) -> jumlah panggilan > 300 ms
const rec = (label, ms, ok) => {
  if (ms > 300) {
    const b = Math.floor((performance.now() - T0 - ms) / 10000) * 10;
    slow.set(b, (slow.get(b) ?? 0) + 1);
  }
  const s = stats.get(label) ?? { ms: [], err: 0, errs: new Map() };
  s.ms.push(ms);
  if (!ok) s.err++;
  stats.set(label, s);
};
async function timed(label, p) {
  const t = performance.now();
  try {
    const r = await p;
    const ok = !r.error;
    rec(label, performance.now() - t, ok);
    if (!ok) {
      const s = stats.get(label);
      const k = r.error.message ?? String(r.error);
      s.errs.set(k, (s.errs.get(k) ?? 0) + 1);
    }
    return r;
  } catch (e) {
    rec(label, performance.now() - t, false);
    const s = stats.get(label);
    s.errs.set(String(e), (s.errs.get(String(e)) ?? 0) + 1);
    return { error: e };
  }
}

async function login(username, password) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `${username}@classmeet.local`, password });
  if (error) throw new Error(`login ${username}: ${error.message}`);
  return data.session.access_token;
}
const clientWith = (token) => {
  const c = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  c.realtime.setAuth(token);
  return c;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timers = [];
const every = (ms, fn) => {
  timers.push(setTimeout(() => timers.push(setInterval(fn, ms)), Math.random() * ms));
};

let channelsOk = 0;
let channelsBad = 0;
const spikeFns = [];
const analysisSpikeFns = [];

function teamClient(token, idx) {
  const c = clientWith(token);
  let assets = [];
  every(5000, async () => {
    await Promise.all([
      timed("pasar: get_market_summary", c.rpc("get_market_summary")),
      timed(
        "pasar: assets",
        c
          .from("assets")
          .select(
            "id,symbol,name,price,last_price,stock,init_stock,price_factor_bps,suspended_until,base_price",
          )
          .eq("is_active", true),
      ),
      timed(
        "pasar: game_settings",
        c
          .from("game_settings")
          .select("state,sell_spread_bps,hold_cap_pct,stock_mid_pct,stock_low_pct")
          .maybeSingle(),
      ),
      timed("pasar: holdings", c.from("holdings").select("asset_id,qty,cost_basis").gt("qty", 0)),
      timed("pasar: get_bankrupt_notices", c.rpc("get_bankrupt_notices")),
      timed("pasar: get_day_open_prices", c.rpc("get_day_open_prices")),
      timed("pasar: get_analysis_offer", c.rpc("get_analysis_offer")),
    ]).then((rs) => {
      if (rs[1]?.data) assets = rs[1].data;
    });
  });
  every(10000, () => timed("saldo: get_my_summary", c.rpc("get_my_summary")));
  every(30000, () =>
    timed(
      "berita: news_feed",
      c
        .from("news_feed")
        .select("news_id,title,body,published_at")
        .order("published_at", { ascending: false })
        .limit(1),
    ),
  );
  every(20000, async () => {
    if (!assets.length) return;
    const a = assets[Math.floor(Math.random() * assets.length)];
    const side = Math.random() < 0.7 ? "buy_asset" : "sell_asset";
    await timed(
      `transaksi: ${side}`,
      c.rpc(side, { p_request_id: randomUUID(), p_asset_id: a.id, p_qty: 1 }),
    );
  });
  spikeFns.push(async (assetId) => {
    await timed(
      "lonjakan: buy_asset",
      c.rpc("buy_asset", { p_request_id: randomUUID(), p_asset_id: assetId, p_qty: 1 }),
    );
  });
  analysisSpikeFns.push(async () => {
    await timed("lonjakan: buy_analysis", c.rpc("buy_analysis", { p_request_id: randomUUID() }));
  });
  c.channel(`lt-${idx}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_feed" }, () => {})
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_settings" }, () => {})
    .subscribe((s) => {
      if (s === "SUBSCRIBED") channelsOk++;
      else if (["CHANNEL_ERROR", "TIMED_OUT"].includes(s)) channelsBad++;
    });
  return c;
}

function displayClient(token) {
  const c = clientWith(token);
  every(5000, async () => {
    await Promise.all([
      timed("display: get_leaderboard", c.rpc("get_leaderboard")),
      timed(
        "display: assets",
        c.from("assets").select("id,symbol,name,price,last_price").eq("is_active", true),
      ),
      timed("display: get_market_index", c.rpc("get_market_index")),
      timed("display: get_day_open_prices", c.rpc("get_day_open_prices")),
      timed("display: get_last_transactions", c.rpc("get_last_transactions", { p_limit: 6 })),
    ]);
  });
  every(30000, () => timed("display: get_index_history", c.rpc("get_index_history")));
}

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((a.length * p) / 100))];

async function main() {
  console.log(
    `Uji beban: ${CLIENTS} klien tim + ${DISPLAYS} display, ${SECONDS} dtk, ${URL_}${SPIKE ? ", dengan lonjakan" : ""}`,
  );
  const teams = seed.teams;
  const tokens = [];
  for (const t of teams) tokens.push(await login(t.username, t.qr_token));
  const dToken = await login(seed.accounts.display.username, seed.accounts.display.password);
  console.log(`Login: ${tokens.length} akun tim dan 1 display berhasil`);
  for (let i = 0; i < CLIENTS; i++) teamClient(tokens[i % tokens.length], i);
  for (let i = 0; i < DISPLAYS; i++) displayClient(dToken);

  if (SPIKE) {
    await sleep((SECONDS * 1000) / 2);
    const probe = clientWith(tokens[0]);
    const { data } = await probe
      .from("assets")
      .select("id,stock")
      .eq("is_active", true)
      .gt("stock", CLIENTS)
      .limit(1);
    if (data?.[0]) {
      console.log("Lonjakan: semua klien membeli 1 unit aset yang sama sekarang");
      await Promise.all(spikeFns.map((f) => f(data[0].id)));
    }
    // Analisa Pasar: semua klien membeli analisa berita yang tayang bersamaan; hanya satu pembelian per tim yang boleh terjadi
    console.log("Lonjakan: semua klien membeli analisa berita yang tayang sekarang");
    await Promise.all(analysisSpikeFns.map((f) => f()));
    await sleep((SECONDS * 1000) / 2);
  } else {
    await sleep(SECONDS * 1000);
  }
  timers.forEach((t) => (clearTimeout(t), clearInterval(t)));
  await sleep(1500);

  console.log(`\nRealtime: ${channelsOk} tersambung, ${channelsBad} gagal dari ${CLIENTS}`);
  console.log(
    "\njenis panggilan".padEnd(36) +
      "n".padStart(7) +
      "median".padStart(9) +
      "p95".padStart(8) +
      "maks".padStart(8) +
      "galat".padStart(7),
  );
  let total = 0;
  let errs = 0;
  for (const [label, s] of [...stats].sort()) {
    const a = [...s.ms].sort((x, y) => x - y);
    total += a.length;
    errs += s.err;
    console.log(
      label.padEnd(36) +
        String(a.length).padStart(7) +
        pct(a, 50).toFixed(0).padStart(9) +
        pct(a, 95).toFixed(0).padStart(8) +
        a[a.length - 1].toFixed(0).padStart(8) +
        String(s.err).padStart(7),
    );
    for (const [m, n] of s.errs) console.log(`    ${n}× ${m.slice(0, 110)}`);
  }
  console.log(
    `\nPanggilan > 300 ms per 10 detik: ${
      [...slow]
        .sort((a, b) => a[0] - b[0])
        .map(([b, n]) => `${b}s:${n}`)
        .join("  ") || "tidak ada"
    }`,
  );
  console.log(`\nTotal ${total} panggilan, ${errs} galat, ${(total / SECONDS).toFixed(1)} panggilan/detik`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
