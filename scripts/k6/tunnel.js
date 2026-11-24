/**
 * Skenario k6: uji beban LEWAT TUNNEL (Cloudflare), meniru perangkat sungguhan di acara. Berbeda dengan
 * scripts/load-test.mjs (RPC langsung ke localhost:8000), skenario ini lewat alamat PUBLIK, jadi ikut terukur:
 * latensi Cloudflare, gerbang Envoy, PostgREST, dan render halaman Next.js (SSR) dengan sesi tim sungguhan.
 *
 * Cara pakai: scripts/k6/README.md (`npm run load-test:k6`). Jangan dijalankan saat acara berlangsung.
 *
 * Tiga kelompok pengguna virtual (VU):
 *  - api_teams    polling seperti papan Pasar tim: get_market_snapshot tiap 5 dtk, saldo tiap 10 dtk, berita tiap 30 dtk
 *                 (+ beli/jual 1 unit tiap ±20 dtk bila TRADES=1; MENGUBAH data staging)
 *  - api_display  layar publik: peringkat, indeks, aset, transaksi terakhir tiap 5 dtk
 *  - pages_team   membuka halaman tim (/team, /team/market, /team/portfolio, /team/history) dengan cookie sesi, jeda 10-30 dtk
 * Tidak mencakup Realtime (WebSocket); itu tetap diuji scripts/load-test.mjs.
 *
 * Variabel (-e NAMA=nilai): SUPABASE_URL (wajib; https://api.<domain>), ANON_KEY (wajib; kunci publik),
 * APP_URL (bawaan run-tunnel.sh: host pertama CLASSMEET_PUBLIC_HOSTS di .env.local; tanpa itu, api. -> app.), TEAM_VUS=30, DISPLAY_VUS=2, PAGE_VUS=8, DURATION=3m, TRADES=0|1.
 * Akun uji dibaca dari scripts/.seed-output.local.json (tidak dicetak, tidak di-commit).
 */
import http from "k6/http";
import encoding from "k6/encoding";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { Rate } from "k6/metrics";

const API = (__ENV.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = __ENV.ANON_KEY || "";
if (!API || !KEY) {
  throw new Error(
    "SUPABASE_URL dan ANON_KEY wajib diisi (lihat scripts/k6/README.md atau jalankan npm run load-test:k6).",
  );
}
const APP = (__ENV.APP_URL || API.replace("//api.", "//app.")).replace(/\/+$/, "");
const TEAM_VUS = Number(__ENV.TEAM_VUS || 30);
const DISPLAY_VUS = Number(__ENV.DISPLAY_VUS || 2);
const PAGE_VUS = Number(__ENV.PAGE_VUS || 8);
const DURATION = __ENV.DURATION || "3m";
const TRADES = __ENV.TRADES === "1";

const seed = JSON.parse(open("../.seed-output.local.json"));

/** Nama cookie sesi: aturan yang sama dengan lib/supabase/cookie-name.ts (`sb-<label pertama host API>-auth-token`). */
const COOKIE_NAME = `sb-${API.match(/^https?:\/\/([^/:]+)/)[1].split(".")[0]}-auth-token`;
/** Batas panjang satu cookie di @supabase/ssr (MAX_CHUNK_SIZE). */
const CHUNK = 3180;

const tradeAccepted = new Rate("trade_accepted");

function scenario(exec_, vus) {
  return { executor: "constant-vus", exec: exec_, vus, duration: DURATION };
}
const scenarios = {};
if (TEAM_VUS > 0) scenarios.api_teams = scenario("teamApi", TEAM_VUS);
if (DISPLAY_VUS > 0) scenarios.api_display = scenario("displayApi", DISPLAY_VUS);
if (PAGE_VUS > 0) scenarios.pages_team = scenario("teamPages", PAGE_VUS);

export const options = {
  scenarios,
  thresholds: {
    // Disetel dari pengukuran lewat tunnel dengan beban penuh (24 Nov): snapshot p95 571-1.100 ms, halaman p95 855-2.290 ms
    // (server kemungkinan masih mode dev). Jaringan lokasi acara bisa berbeda; ukur ulang dari sana.
    "http_req_duration{name:snapshot}": ["p(95)<1500"],
    "http_req_duration{kind:page}": ["p(95)<3500"],
    "http_req_failed{scenario:api_teams}": ["rate<0.01"],
    "http_req_failed{scenario:api_display}": ["rate<0.01"],
    "http_req_failed{scenario:pages_team}": ["rate<0.01"],
    checks: ["rate>0.99"],
    // Hanya bila TRADES=1: sebagian besar beli/jual harus DITERIMA. Bila nyaris semua ditolak (saldo/kepemilikan akun
    // uji 0), uji jalur tulis tidak bermakna dan ambang ini gagal sebagai peringatan.
    ...(TRADES ? { trade_accepted: ["rate>0.5"] } : {}),
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

export function setup() {
  const health = http.get(`${APP}/api/health`, { tags: { name: "health" } });
  if (health.status !== 200) {
    fail(
      `${APP}/api/health -> HTTP ${health.status}. Aplikasi tidak terjangkau; periksa alamatnya ` +
        `(-e APP_URL=https://<host aplikasi>) dan bahwa tunnel dan aplikasi sedang jalan.`,
    );
  }

  const login = (username, password) => {
    const res = http.post(
      `${API}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: `${username}@classmeet.local`, password }),
      { headers: { apikey: KEY, "Content-Type": "application/json" }, tags: { name: "login" } },
    );
    if (res.status !== 200) fail(`login ${username}: HTTP ${res.status}`);
    return res.json();
  };
  return {
    teams: seed.teams.map((t) => login(t.username, t.qr_token)),
    display: login(seed.accounts.display.username, seed.accounts.display.password),
  };
}

const rest = (path) => `${API}/rest/v1/${path}`;
const authHeaders = (session) => ({
  apikey: KEY,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
});
const teamSession = (data) => data.teams[(exec.vu.idInTest - 1) % data.teams.length];

function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Papan Pasar tim (API)
// ---------------------------------------------------------------------------------------------------------------------
export function teamApi(data) {
  const headers = authHeaders(teamSession(data));
  const i = exec.vu.iterationInScenario;
  if (i === 0) sleep(Math.random() * 5); // sebarkan awal antar VU, seperti klien sungguhan

  const snap = http.post(rest("rpc/get_market_snapshot"), "{}", { headers, tags: { name: "snapshot" } });
  let assets = [];
  const ok = check(snap, {
    "snapshot: 200": (r) => r.status === 200,
    "snapshot: berisi aset": (r) => {
      try {
        assets = r.json("assets");
        return assets.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (i % 2 === 0) {
    const r = http.post(rest("rpc/get_my_summary"), "{}", { headers, tags: { name: "saldo" } });
    check(r, { "saldo: 200": (x) => x.status === 200 });
  }
  if (i % 6 === 0) {
    const r = http.get(
      rest("news_feed?select=news_id,title,body,published_at&order=published_at.desc&limit=1"),
      {
        headers,
        tags: { name: "berita" },
      },
    );
    check(r, { "berita: 200": (x) => x.status === 200 });
  }
  if (TRADES && ok && i % 4 === 3) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const fn = Math.random() < 0.7 ? "buy_asset" : "sell_asset";
    const r = http.post(
      rest(`rpc/${fn}`),
      JSON.stringify({ p_request_id: uuid4(), p_asset_id: asset.id, p_qty: 1 }),
      {
        headers,
        tags: { name: fn },
        // 400 = penolakan aturan game (saldo/stok/kepemilikan kurang): bukan kegagalan teknis.
        responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 400),
      },
    );
    tradeAccepted.add(r.status === 200);
  }
  sleep(5);
}

// ---------------------------------------------------------------------------------------------------------------------
// Layar publik (API)
// ---------------------------------------------------------------------------------------------------------------------
export function displayApi(data) {
  const headers = authHeaders(data.display);
  if (exec.vu.iterationInScenario === 0) sleep(Math.random() * 5);
  const rpc = (name, body, tag) => ({
    method: "POST",
    url: rest(`rpc/${name}`),
    body: JSON.stringify(body || {}),
    params: { headers, tags: { name: tag } },
  });
  const res = http.batch([
    rpc("get_leaderboard", {}, "display-leaderboard"),
    rpc("get_market_index", {}, "display-index"),
    rpc("get_last_transactions", { p_limit: 6 }, "display-transaksi"),
    {
      method: "GET",
      url: rest("assets?select=id,symbol,name,price,last_price&is_active=eq.true"),
      params: { headers, tags: { name: "display-aset" } },
    },
  ]);
  check(res[0], { "display: peringkat 200": (r) => r.status === 200 });
  check(res[3], { "display: aset 200": (r) => r.status === 200 });
  sleep(5);
}

// ---------------------------------------------------------------------------------------------------------------------
// Halaman tim (SSR lewat Next.js) dengan cookie sesi seperti yang ditulis @supabase/ssr
// ---------------------------------------------------------------------------------------------------------------------
function sessionCookies(session) {
  // `base64-` + base64url(JSON sesi); lebih dari 3180 karakter dipecah menjadi `<nama>.0`, `<nama>.1`, ...
  const value = "base64-" + encoding.b64encode(JSON.stringify(session), "rawurl");
  if (value.length <= CHUNK) return [[COOKIE_NAME, value]];
  const out = [];
  for (let i = 0, n = 0; i < value.length; i += CHUNK, n++)
    out.push([`${COOKIE_NAME}.${n}`, value.slice(i, i + CHUNK)]);
  return out;
}

const PAGES = ["/team", "/team/market", "/team/portfolio", "/team/history"];

export function teamPages(data) {
  // k6 MENGOSONGKAN cookie jar di awal tiap iterasi (kecuali `noCookiesReset`), jadi cookie sesi dipasang ulang di
  // SETIAP iterasi. Memasangnya sekali saja membuat hanya kunjungan pertama tiap VU yang masuk; sisanya dialihkan ke /kiosk.
  const jar = http.cookieJar();
  sessionCookies(teamSession(data)).forEach(([name, value]) => jar.set(APP, name, value));
  if (exec.vu.iterationInScenario === 0) sleep(Math.random() * 10); // sebarkan awal antar VU
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  // redirects: 0 supaya sesi yang tidak dikenali (dialihkan ke /kiosk) tidak lolos sebagai "200".
  const res = http.get(`${APP}${path}`, { redirects: 0, tags: { kind: "page", name: path } });
  const pageOk = check(res, {
    "halaman: 200 (bukan dialihkan ke login)": (r) => r.status === 200,
    "halaman: ada isi": (r) => r.body && r.body.length > 1000,
  });
  if (!pageOk) {
    // Diagnosis (tanpa token/cookie): halaman mana, status apa, dialihkan ke mana, dan berapa byte.
    const bytes = res.body ? res.body.length : 0;
    console.warn(
      `[halaman gagal] ${path} -> HTTP ${res.status}, Location=${res.headers["Location"] || "-"}, ${bytes} byte, ${Math.round(res.timings.duration)} ms`,
    );
  }
  sleep(10 + Math.random() * 20);
}
