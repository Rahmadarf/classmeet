// Pemeriksa dan pengimpor berita.  Jalankan dari laptop panitia (Node 22+):
//
//   node --experimental-strip-types scripts/import-news.ts check  news.json assets.json [--steps 220] [--runs 2000]
//   node --experimental-strip-types scripts/import-news.ts import news.json            [--apply] [--ready]
//
// check  : OFFLINE. Validasi aturan + simulasi apakah kumpulan berita cukup dan tidak membuat harga macet di batas.
// import : ONLINE. Tanpa --apply hanya latihan (dry-run). Dengan --apply memanggil admin_save_news per berita
//          (dan admin_set_news_ready bila --ready). Berita dengan judul yang sudah ada dilewati (aman dijalankan ulang).
// PENTING: kumpulan hanya bisa ditulis SEBELUM game dibuka. Sejak pembukaan pertama database menolak semuanya
// (game_started_locked). Impor dan tandai siap seluruh berita (±220) sebelum menekan Buka pasar.
// Catatan simulasi: di database, bila tidak ada calon yang aman, sistem tetap memilih berita acak dan menjepit harga ke batas
// (pasar tidak macet). Di sini "habis" berarti tahap itu akan terjadi penjepitan; kurangi dengan menyeimbangkan efek naik/turun.
// Env untuk import: SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD  (akun peran admin; bukan service role).
import { readFileSync } from "node:fs";
import { toBps, validateItem, wouldHitBounds, simulate, type Asset, type NewsItem } from "./news-lib.ts";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const files = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && ["--steps", "--runs"].includes(args[i - 1])));
const cmd = files[0];

const loadNews = (p: string): NewsItem[] => JSON.parse(readFileSync(p, "utf8"));

function staticReport(items: NewsItem[], symbols: Set<string>): number {
  let bad = 0; const titles = new Map<string, number>();
  items.forEach((it, i) => {
    const e = validateItem(it, symbols);
    const t = (it.judul ?? "").trim().toLowerCase();
    if (t) { if (titles.has(t)) e.push(`judul sama dengan berita #${titles.get(t)! + 1}`); else titles.set(t, i); }
    if (e.length) { bad++; console.log(`  #${i + 1} "${(it.judul ?? "").slice(0, 50)}": ${e.join("; ")}`); }
  });
  console.log(bad ? `${bad} dari ${items.length} berita punya masalah.` : `Semua ${items.length} berita lolos aturan.`);
  return bad;
}

async function main() {
  if (cmd === "check") {
    const items = loadNews(files[1]); const assets: Asset[] = JSON.parse(readFileSync(files[2], "utf8"));
    const steps = opt("--steps", 220), runs = opt("--runs", 2000);
    console.log(`Memeriksa ${items.length} berita terhadap ${assets.length} aset…`);
    const bad = staticReport(items, new Set(assets.map((a) => a.symbol)));
    const good = items.filter((it) => validateItem(it, new Set(assets.map((a) => a.symbol))).length === 0);
    if (good.length < steps) console.log(`PERINGATAN: hanya ${good.length} berita valid, kebutuhan ≈ ${steps}.`);
    const map = new Map(assets.map((a) => [a.symbol, a]));
    console.log(`Boleh terbit pada harga awal: ${good.filter((it) => !wouldHitBounds(it, map)).length} dari ${good.length}.`);
    const rep = simulate(good, assets, steps, runs);
    console.log(`\nSimulasi ${rep.runs} permainan × ${rep.steps} berita:`);
    console.log(`  macet (tak ada berita boleh terbit) : ${rep.exhaustedRuns} permainan (${rep.exhaustedPct}%), paling cepat di berita ke-${rep.firstExhaustionStep ?? "-"}`);
    console.log(`  rata-rata berita yang sempat terbit  : ${rep.meanStepsDone}`);
    console.log(`\n  ${"aset".padEnd(8)} ${"muncul".padStart(6)} ${"Σ%".padStart(7)} ${"min".padStart(9)} ${"maks".padStart(9)} ${"rata² akhir".padStart(12)}`);
    for (const [s, r] of Object.entries(rep.perAsset))
      console.log(`  ${s.padEnd(8)} ${String(r.touches).padStart(6)} ${String(r.netPct).padStart(7)} ${String(r.minSeen).padStart(9)} ${String(r.maxSeen).padStart(9)} ${String(r.meanFinal).padStart(12)}`);
    console.log("\nCatatan: Σ% jauh dari 0 berarti aset itu cenderung terus naik/turun dan menabrak batas; seimbangkan arahnya.");
    process.exit(bad || rep.exhaustedPct > 0 ? 1 : 0);
  }
  if (cmd === "import") {
    const items = loadNews(files[1]); const apply = flag("--apply"), ready = flag("--ready");
    const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Env SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD wajib diisi");
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: le } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (le) throw new Error("login admin gagal: " + le.message);
    const { data: rows, error: ae } = await sb.from("assets").select("id,symbol,price,min_price,max_price,is_active");
    if (ae || !rows) throw new Error("gagal membaca aset: " + ae?.message);
    const byS = new Map(rows.map((r: any) => [r.symbol, r]));
    if (staticReport(items, new Set(byS.keys()))) throw new Error("Perbaiki berita dulu (lihat daftar di atas); tidak ada yang diimpor.");
    const { data: ex } = await sb.from("news").select("title");
    const have = new Set((ex ?? []).map((r: any) => String(r.title).trim().toLowerCase()));
    let saved = 0, skipped = 0, failed = 0;
    for (const [i, it] of items.entries()) {
      if (have.has(it.judul.trim().toLowerCase())) { skipped++; continue; }
      if (!apply) { console.log(`  [latihan] #${i + 1} ${it.judul}`); continue; }
      const eff = it.efek.map((e) => ({ asset_id: (byS.get(e.simbol) as any).id, pct_bps: toBps(e.persen) }));
      const { data: id, error } = await sb.rpc("admin_save_news", { p_news_id: null, p_title: it.judul, p_body: it.isi, p_effects: eff });
      if (error) { failed++; console.log(`  GAGAL #${i + 1} ${it.judul}: ${error.message}`); continue; }
      if (ready) { const { error: re } = await sb.rpc("admin_set_news_ready", { p_news_id: id, p_ready: true }); if (re) { failed++; console.log(`  GAGAL siap #${i + 1}: ${re.message}`); continue; } }
      saved++;
    }
    console.log(`${apply ? "Tersimpan" : "Latihan selesai; akan disimpan"}: ${apply ? saved : items.length - skipped}, dilewati (judul sudah ada): ${skipped}, gagal: ${failed}.`);
    if (!apply) console.log("Tambahkan --apply untuk benar-benar menyimpan (dan --ready untuk langsung menandai siap).");
    process.exit(failed ? 1 : 0);
  }
  console.log("Pemakaian:\n  check  news.json assets.json [--steps 220] [--runs 2000]\n  import news.json [--apply] [--ready]");
  process.exit(2);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
