/**
 * Seed data uji ke Supabase STAGING. Dijalankan LOKAL oleh panitia/developer, idempoten.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Membuat: 1 admin, 1 display, 6 penjaga (+6 pos; skema membatasi satu penjaga = satu pos), 2 PIC lomba (+2 lomba),
 * 5 tim (kata sandi akun tim = qr_token), 30 aset, dan 12 berita (lewat RPC admin, status `ready`).
 *
 * Aturan keras:
 *  - Kunci service_role hanya dibaca dari env shell. Tidak pernah ditulis ke berkas, log, atau .env.local.
 *  - qr_token dan kata sandi TIDAK dicetak ke log. Semuanya ditulis ke scripts/.seed-output.local.json
 *    (di-gitignore, mode 0600) untuk dipakai mencetak kartu / login uji.
 *  - Menolak berjalan terhadap project selain staging, kecuali SEED_ALLOW_ANY_PROJECT=1.
 *  - Aset dan berita hanya dibuat sebelum game dibuka (state `setup`, `started_at` kosong).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../lib/supabase/database.types";
import assetsFile from "./data/assets.example.json";
import poolFile from "./data/news-pool.json";
import {
  buildAssetRow,
  generateShortCode,
  randomPassword,
  validateAssets,
  validateNews,
  type AssetSeed,
  type NewsSeed,
} from "./seed-lib";

const STAGING_REF = "sjqboaqkhykmzconskvn";
const EMAIL_DOMAIN = "classmeet.local";
const OUTPUT_PATH = join(dirname(fileURLToPath(import.meta.url)), ".seed-output.local.json");

type Role = Database["public"]["Enums"]["app_role"];
type Db = SupabaseClient<Database>;

type Output = {
  note: string;
  accounts: Record<string, { username: string; password: string }>;
  teams: { name: string; username: string; qr_token: string; short_code: string }[];
};

const TEAM_NAMES = ["Tim Elang", "Tim Harimau", "Tim Naga", "Tim Rajawali", "Tim Cendrawasih"];

// Skema: posts.guard_id unik → satu penjaga memegang satu pos. Enam penjaga = enam pos contoh.
const POSTS = [
  { name: "Lempar Bola", location: "Lapangan Basket", open: true },
  { name: "Teka-teki Kata", location: "Aula Utama", open: true },
  { name: "Estafet Balon", location: "Lapangan Upacara", open: false },
  { name: "Menara Kartu", location: "Perpustakaan", open: true },
  { name: "Tarik Tambang", location: "Lapangan Voli", open: false },
  { name: "Cerdas Cermat", location: "Ruang Multimedia", open: false },
];

// PIC lomba (role `pic`, hari 1 dan 3): satu PIC memegang satu lomba (`posts.kind = 'lomba'`), tanpa saklar buka/tutup.
const LOMBAS = [
  { name: "Futsal Antarkelas", location: "Lapangan Futsal" },
  { name: "Cerdas Cermat Umum", location: "Aula Utama" },
];

function die(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function must<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) die(`${what}: ${result.error.message}`);
  return result.data;
}

function loadOutput(): Output {
  if (existsSync(OUTPUT_PATH)) {
    try {
      return JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as Output;
    } catch {
      // berkas rusak: buat ulang
    }
  }
  return { note: "Kredensial akun UJI staging. Jangan di-commit.", accounts: {}, teams: [] };
}

function saveOutput(out: Output) {
  writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), { mode: 0o600 });
  chmodSync(OUTPUT_PATH, 0o600);
}

async function findUserId(admin: Db, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Buat akun Auth bila belum ada; selalu pastikan kata sandinya sama dengan yang diberikan. */
async function ensureAuthUser(
  admin: Db,
  username: string,
  password: string,
): Promise<{ id: string; created: boolean }> {
  const email = `${username}@${EMAIL_DOMAIN}`;
  const existing = await findUserId(admin, email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
    if (error) die(`updateUser ${username}: ${error.message}`);
    return { id: existing, created: false };
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) die(`createUser ${username}: ${error?.message ?? "tanpa data"}`);
  return { id: data.user.id, created: true };
}

async function ensureProfile(admin: Db, id: string, username: string, role: Role, displayName: string) {
  must(
    await admin
      .from("profiles")
      .upsert({ id, username, role, display_name: displayName }, { onConflict: "id" }),
    `profil ${username}`,
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey)
    die("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY kosong (jalankan lewat `npm run seed`).");
  if (!serviceKey)
    die("SUPABASE_SERVICE_ROLE_KEY kosong. Berikan lewat shell: SUPABASE_SERVICE_ROLE_KEY=... npm run seed");
  if (!url.includes(STAGING_REF) && process.env.SEED_ALLOW_ANY_PROJECT !== "1") {
    die(`URL bukan project staging (${STAGING_REF}). Set SEED_ALLOW_ANY_PROJECT=1 bila memang disengaja.`);
  }

  // Validasi data lebih dulu; jangan sentuh DB bila data contoh rusak.
  const assetSeeds = assetsFile.assets as AssetSeed[];
  const newsSeeds = poolFile.news as unknown as NewsSeed[];
  const dataProblems = [
    ...validateAssets(assetSeeds),
    ...validateNews(newsSeeds, new Set(assetSeeds.map((a) => a.symbol))),
  ];
  if (dataProblems.length) die(`Data contoh tidak valid:\n  - ${dataProblems.join("\n  - ")}`);

  const admin: Db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const out = loadOutput();
  console.log(`Seed ke ${new URL(url).host}`);

  // --- status game: aset dan berita hanya boleh dibuat sebelum game dibuka ---
  const settings = must(
    await admin.from("game_settings").select("state,started_at").maybeSingle(),
    "game_settings",
  );
  const locked = !settings || settings.started_at !== null;
  if (locked) console.log("• game sudah dibuka: aset dan berita dilewati (terkunci database)");

  // --- akun non-tim: admin, display, penjaga ---
  const sharedPassword = process.env.SEED_PASSWORD;
  const passwordFor = (username: string) =>
    sharedPassword ?? out.accounts[username]?.password ?? randomPassword();

  const plain: { username: string; role: Role; display: string }[] = [
    { username: "admin", role: "admin", display: "Panitia Admin" },
    { username: "display", role: "display", display: "Layar Publik" },
    ...POSTS.map((_, i) => ({
      username: `guard${i + 1}`,
      role: "guard" as Role,
      display: `Penjaga Pos ${i + 1}`,
    })),
    ...LOMBAS.map((_, i) => ({
      username: `pic${i + 1}`,
      role: "pic" as Role,
      display: `PIC Lomba ${i + 1}`,
    })),
  ];
  const ids: Record<string, string> = {};
  for (const acct of plain) {
    const password = passwordFor(acct.username);
    const { id, created } = await ensureAuthUser(admin, acct.username, password);
    await ensureProfile(admin, id, acct.username, acct.role, acct.display);
    ids[acct.username] = id;
    out.accounts[acct.username] = { username: acct.username, password };
    console.log(`• ${created ? "dibuat " : "ada    "} ${acct.role.padEnd(7)} ${acct.username}`);
  }

  // --- pos: satu per penjaga; status buka hanya diisi saat dibuat ---
  for (let i = 0; i < POSTS.length; i++) {
    const guardId = ids[`guard${i + 1}`];
    const existing = must(
      await admin.from("posts").select("id").eq("guard_id", guardId).maybeSingle(),
      "cek pos",
    );
    if (existing) continue;
    must(
      await admin.from("posts").insert({
        name: `Pos ${i + 1} · ${POSTS[i].name}`,
        location: POSTS[i].location,
        guard_id: guardId,
        is_open: POSTS[i].open,
      }),
      `pos ${i + 1}`,
    );
    console.log(`• pos dibuat: Pos ${i + 1} · ${POSTS[i].name}`);
  }

  // --- lomba: satu per PIC; `is_open` tidak dipakai (tanpa saklar) ---
  for (let i = 0; i < LOMBAS.length; i++) {
    const picId = ids[`pic${i + 1}`];
    const existing = must(
      await admin.from("posts").select("id").eq("guard_id", picId).maybeSingle(),
      "cek lomba",
    );
    if (existing) continue;
    must(
      await admin.from("posts").insert({
        name: `Lomba ${i + 1} · ${LOMBAS[i].name}`,
        location: LOMBAS[i].location,
        guard_id: picId,
        is_open: false,
        kind: "lomba",
      }),
      `lomba ${i + 1}`,
    );
    console.log(`• lomba dibuat: Lomba ${i + 1} · ${LOMBAS[i].name}`);
  }

  // --- tim: kata sandi akun = qr_token ---
  const takenCodes = new Set(
    (must(await admin.from("teams").select("short_code"), "short_code") ?? []).map((t) => t.short_code),
  );
  out.teams = [];
  for (let i = 0; i < TEAM_NAMES.length; i++) {
    const username = `tim${i + 1}`;
    const name = TEAM_NAMES[i];
    const existing = must(
      await admin.from("teams").select("id,qr_token,short_code").eq("name", name).maybeSingle(),
      `cek tim ${name}`,
    );
    const token = existing?.qr_token ?? randomUUID();
    const { id, created } = await ensureAuthUser(admin, username, token);
    await ensureProfile(admin, id, username, "team", name);
    let shortCode = existing?.short_code;
    if (!existing) {
      shortCode = generateShortCode(takenCodes);
      must(
        await admin.from("teams").insert({ id, name, qr_token: token, short_code: shortCode }),
        `tim ${name}`,
      );
    }
    out.teams.push({ name, username, qr_token: token, short_code: shortCode! });
    console.log(`• ${created || !existing ? "dibuat " : "ada    "} team    ${username} (${name})`);
  }

  // --- aset ---
  if (!locked) {
    const have = new Set(
      (must(await admin.from("assets").select("symbol"), "aset") ?? []).map((a) => a.symbol),
    );
    const fresh = assetSeeds.filter((a) => !have.has(a.symbol)).map(buildAssetRow);
    if (fresh.length) must(await admin.from("assets").insert(fresh), "insert aset");
    console.log(`• aset: ${fresh.length} dibuat, ${have.size} sudah ada (total ${assetSeeds.length})`);
  }

  // --- berita: lewat RPC admin supaya aturan efek divalidasi database ---
  if (!locked) {
    const haveTitles = new Set(
      (must(await admin.from("news").select("title"), "berita") ?? []).map((n) => n.title),
    );
    const todo = newsSeeds.filter((n) => !haveTitles.has(n.title));
    if (todo.length) {
      const adminClient: Db = createClient<Database>(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await adminClient.auth.signInWithPassword({
        email: `admin@${EMAIL_DOMAIN}`,
        password: out.accounts.admin.password,
      });
      if (signIn.error) die(`login admin untuk berita: ${signIn.error.message}`);

      const assetRows = must(await admin.from("assets").select("id,symbol"), "peta aset") ?? [];
      const idBySymbol = new Map(assetRows.map((a) => [a.symbol, a.id]));

      for (const n of todo) {
        const effects = n.effects.map((e) => ({ asset_id: idBySymbol.get(e.symbol)!, pct_bps: e.pct_bps }));
        const saved = await adminClient.rpc("admin_save_news", {
          p_news_id: null as unknown as string,
          p_title: n.title,
          p_body: n.body,
          p_effects: effects,
        });
        if (saved.error) die(`admin_save_news "${n.title}": ${saved.error.message}`);
        if (n.event) {
          const target = idBySymbol.get(n.event.symbol)!;
          const ev =
            n.kind === "bankrupt"
              ? await adminClient.rpc("admin_set_news_bankruptcy", {
                  p_news_id: saved.data,
                  p_asset_id: target,
                  p_liquidation_bps: n.event.amount,
                })
              : await adminClient.rpc("admin_set_news_event", {
                  p_news_id: saved.data,
                  p_asset_id: target,
                  p_kind: n.kind!,
                  p_amount: n.event.amount,
                });
          if (ev.error) die(`event "${n.title}": ${ev.error.message}`);
        }
        const ready = await adminClient.rpc("admin_set_news_ready", { p_news_id: saved.data, p_ready: true });
        if (ready.error) die(`admin_set_news_ready "${n.title}": ${ready.error.message}`);
      }
      await adminClient.auth.signOut();
    }
    console.log(
      `• berita: ${todo.length} dibuat (status ready), ${newsSeeds.length - todo.length} sudah ada`,
    );
  }

  saveOutput(out);
  console.log(`\n✔ Selesai. Kredensial akun uji (termasuk qr_token tim) ada di ${OUTPUT_PATH}`);
  console.log("  Berkas itu di-gitignore. Jangan dibagikan atau di-commit.");
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
