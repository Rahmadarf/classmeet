/**
 * Pengurai dokumen anggota tim (impor di /admin/teams). Format per BLOK: nama tim di satu baris sendiri, lalu anggotanya di baris
 * berikutnya (`nama, kelas, peran`), satu baris kosong memisahkan tim. Baris judul kolom di bawah nama tim boleh ada.
 *
 *   Tim Elang
 *   nama,kelas,peran
 *   Budi Santoso,XI IPA 1,Ketua
 *   Siti Aminah,XI IPA 2,Anggota
 *
 *   Tim Naga
 *   Rina Putri,X IPA 1,Ketua
 *
 * Sebuah baris dianggap NAMA TIM bila ia di awal berkas atau tepat sesudah baris kosong, dan hanya kolom pertamanya yang terisi.
 * Pemisah kolom (koma, titik koma, tab) dideteksi otomatis, jadi CSV dari Excel berlokal Indonesia dan hasil salin dari
 * spreadsheet sama-sama terbaca. Berkas ini murni (tanpa I/O) supaya mudah diuji; pencocokan nama tim dengan database dilakukan
 * oleh pemanggil, dan database memvalidasi ulang semuanya.
 */

export const MAX_MEMBER_ROWS = 2000;
export const MAX_NAME_LEN = 80;
export const MAX_CLASS_LEN = 40;

export type ParsedMember = { name: string; className: string | null; captain: boolean; line: number };
export type ParsedTeam = { name: string; line: number; members: ParsedMember[] };
export type ParseIssue = { line: number; level: "error" | "warning"; message: string };
export type ParseResult = {
  teams: ParsedTeam[];
  issues: ParseIssue[];
  /** Jumlah anggota yang terbaca (di semua tim). */
  memberCount: number;
  delimiter: "," | ";" | "\t";
};

/** Baris yang dikirim ke `admin_import_team_members`. */
export type ImportRow = { team: string; name: string; class: string | null; captain: boolean };

/** Rapikan spasi: pangkas dan ganti rangkaian spasi dengan satu spasi (sama dengan yang dilakukan database). */
export const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** Kunci pencocokan nama (tanpa membedakan huruf besar/kecil dan spasi ganda). */
export const nameKey = (s: string) => tidy(s).toLowerCase();

type Row = { cells: string[]; line: number };

const DELIMITERS = [",", ";", "\t"] as const;

/** Hitung kemunculan pemisah di luar tanda kutip. */
function countDelimiter(text: string, d: string): number {
  let inQuotes = false;
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && c === d) n++;
  }
  return n;
}

export function detectDelimiter(text: string): ParseResult["delimiter"] {
  let best: ParseResult["delimiter"] = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const n = countDelimiter(text, d);
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

/** Pecah teks jadi baris dan sel; mendukung sel berkutip (termasuk pemisah, kutip ganda "", dan baris baru di dalamnya). */
function tokenize(text: string, d: string): Row[] {
  const rows: Row[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let startLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === "\n") line++;
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === "") {
      inQuotes = true;
    } else if (c === d) {
      cells.push(cell);
      cell = "";
    } else if (c === "\n") {
      cells.push(cell);
      rows.push({ cells, line: startLine });
      cells = [];
      cell = "";
      line++;
      startLine = line;
    } else {
      cell += c;
    }
  }
  cells.push(cell);
  rows.push({ cells, line: startLine });
  return rows;
}

const NAME_HEADERS = new Set(["nama", "nama anggota", "name"]);
const CLASS_HEADERS = new Set(["kelas", "class"]);
const ROLE_HEADERS = new Set(["peran", "jabatan", "role"]);

/** Baris judul kolom (`nama, kelas, peran`), boleh sebagian. */
function isHeaderRow(cells: string[]): boolean {
  const [a = "", b = "", c = ""] = cells.map((x) => nameKey(x));
  if (!NAME_HEADERS.has(a)) return false;
  if (b !== "" && !CLASS_HEADERS.has(b)) return false;
  if (c !== "" && !ROLE_HEADERS.has(c)) return false;
  return cells.slice(3).every((x) => tidy(x) === "");
}

/** `true` ketua, `false` anggota, `null` tidak dikenal. Kosong dianggap anggota. */
function parseRole(raw: string): boolean | null {
  const v = nameKey(raw);
  if (v === "" || v === "anggota" || v === "member") return false;
  if (v === "ketua" || v === "captain") return true;
  return null;
}

export function parseMembers(input: string): ParseResult {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(text);
  const rows = tokenize(text, delimiter);
  const issues: ParseIssue[] = [];
  const teams: ParsedTeam[] = [];
  const byKey = new Map<string, ParsedTeam>();

  let current: ParsedTeam | null = null;
  let seen = new Set<string>();
  let atBlockStart = true; // di awal berkas, atau tepat sesudah baris kosong
  let memberCount = 0;

  for (const row of rows) {
    const cells = row.cells.map(tidy);
    if (cells.every((c) => c === "")) {
      atBlockStart = true;
      continue;
    }
    const first = cells[0] ?? "";
    const onlyFirst = first !== "" && cells.slice(1).every((c) => c === "");

    if (atBlockStart && onlyFirst) {
      // nama tim baru; blok kedua untuk tim yang sama digabung
      const key = nameKey(first);
      let team = byKey.get(key);
      if (team) {
        issues.push({
          line: row.line,
          level: "warning",
          message: `Tim "${first}" muncul lagi; anggotanya digabung dengan blok sebelumnya (baris ${team.line}).`,
        });
      } else {
        team = { name: first, line: row.line, members: [] };
        byKey.set(key, team);
        teams.push(team);
      }
      current = team;
      seen = new Set(team.members.map((m) => nameKey(m.name)));
      atBlockStart = false;
      continue;
    }
    atBlockStart = false;

    if (isHeaderRow(cells)) continue;

    if (!current) {
      issues.push({
        line: row.line,
        level: "error",
        message: `Anggota "${first}" tidak berada di bawah nama tim. Tulis nama tim di satu baris sendiri lebih dulu.`,
      });
      continue;
    }

    const name = first;
    const className = cells[1] ? cells[1] : null;
    if (name === "") {
      issues.push({ line: row.line, level: "error", message: "Nama anggota kosong." });
      continue;
    }
    let bad = false;
    if (name.length > MAX_NAME_LEN) {
      issues.push({
        line: row.line,
        level: "error",
        message: `Nama terlalu panjang (maksimal ${MAX_NAME_LEN} huruf).`,
      });
      bad = true;
    }
    if (className && className.length > MAX_CLASS_LEN) {
      issues.push({
        line: row.line,
        level: "error",
        message: `Kelas terlalu panjang (maksimal ${MAX_CLASS_LEN} huruf).`,
      });
      bad = true;
    }
    const captain = parseRole(cells[2] ?? "");
    if (captain === null) {
      issues.push({
        line: row.line,
        level: "error",
        message: `Peran "${cells[2]}" tidak dikenal. Isi Ketua atau Anggota, atau kosongkan.`,
      });
      bad = true;
    }
    if (cells.slice(3).some((c) => c !== "")) {
      issues.push({ line: row.line, level: "warning", message: "Kolom setelah peran diabaikan." });
    }
    const key = nameKey(name);
    if (seen.has(key)) {
      issues.push({ line: row.line, level: "error", message: `"${name}" sudah ada di ${current.name}.` });
      bad = true;
    }
    if (bad) continue;
    seen.add(key);
    current.members.push({ name, className, captain: captain === true, line: row.line });
    memberCount++;
  }

  // pemeriksaan per tim dan antar tim
  for (const t of teams) {
    if (t.members.length === 0) {
      issues.push({
        line: t.line,
        level: "warning",
        message: `Tim "${t.name}" tidak punya anggota di berkas, jadi dilewati (anggota lamanya tidak berubah).`,
      });
    }
    const captains = t.members.filter((m) => m.captain);
    if (captains.length > 1) {
      issues.push({
        line: captains[1].line,
        level: "warning",
        message: `Tim "${t.name}" punya ${captains.length} ketua.`,
      });
    }
  }
  const where = new Map<string, ParsedTeam>();
  for (const t of teams) {
    for (const m of t.members) {
      if (!m.className) continue;
      const key = `${nameKey(m.name)}|${nameKey(m.className)}`;
      const other = where.get(key);
      if (other && other !== t) {
        issues.push({
          line: m.line,
          level: "warning",
          message: `"${m.name}" (${m.className}) juga ada di ${other.name}. Apakah orang yang sama?`,
        });
      } else if (!other) where.set(key, t);
    }
  }
  if (memberCount > MAX_MEMBER_ROWS) {
    issues.push({
      line: 1,
      level: "error",
      message: `Terlalu banyak anggota (${memberCount}); maksimal ${MAX_MEMBER_ROWS} per impor. Bagi berkas menjadi beberapa bagian.`,
    });
  }
  if (teams.length === 0 && issues.every((i) => i.level !== "error")) {
    issues.push({
      line: 1,
      level: "error",
      message: "Tidak ada nama tim atau anggota yang terbaca. Periksa format berkas.",
    });
  }
  issues.sort((a, b) => a.line - b.line);
  return { teams, issues, memberCount, delimiter };
}

export const hasErrors = (r: ParseResult) => r.issues.some((i) => i.level === "error");

/** Baris datar untuk `admin_import_team_members`; hanya tim yang punya anggota (tim tanpa anggota dilewati). */
export function toImportRows(r: ParseResult): ImportRow[] {
  return r.teams.flatMap((t) =>
    t.members.map((m) => ({ team: t.name, name: m.name, class: m.className, captain: m.captain })),
  );
}

// ---------- keluaran CSV ----------
const needsQuote = (s: string) => /[",;\t\n\r]/.test(s) || s !== s.trim();
const csvCell = (s: string) => (needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Satu blok tim dalam format impor (nama tim, judul kolom, anggota). */
export function teamBlockCsv(
  teamName: string,
  members: { name: string; className: string | null; captain: boolean }[],
): string {
  const lines = [csvCell(teamName), "nama,kelas,peran"];
  for (const m of members)
    lines.push([csvCell(m.name), csvCell(m.className ?? ""), m.captain ? "Ketua" : "Anggota"].join(","));
  return lines.join("\n");
}

/** Templat yang diunduh admin: dua tim contoh dalam format blok. BOM supaya Excel membaca UTF-8. */
export function templateCsv(): string {
  return (
    "﻿" +
    [
      teamBlockCsv("Tim Elang", [
        { name: "Budi Santoso", className: "XI IPA 1", captain: true },
        { name: "Siti Aminah", className: "XI IPA 2", captain: false },
      ]),
      teamBlockCsv("Tim Naga", [
        { name: "Rina Putri", className: "X IPA 1", captain: true },
        { name: "Dedi Kurniawan", className: "X IPA 2", captain: false },
      ]),
    ].join("\n\n") +
    "\n"
  );
}
