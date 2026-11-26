import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  hasErrors,
  nameKey,
  parseMembers,
  teamBlockCsv,
  templateCsv,
  tidy,
  toImportRows,
} from "./members";

const BLOCKS = `Tim Elang
nama,kelas,peran
Budi Santoso,XI IPA 1,Ketua
Siti Aminah,XI IPA 2,Anggota

Tim Naga
nama,kelas,peran
Rina Putri,X IPA 1,Ketua
Fajar Pratama,XI IPS 2,
`;

const errors = (r: ReturnType<typeof parseMembers>) =>
  r.issues.filter((i) => i.level === "error").map((i) => i.message);
const warnings = (r: ReturnType<typeof parseMembers>) =>
  r.issues.filter((i) => i.level === "warning").map((i) => i.message);

describe("tidy / nameKey", () => {
  it("merapikan spasi dan tidak membedakan huruf", () => {
    expect(tidy("  Tim   Elang ")).toBe("Tim Elang");
    expect(nameKey("  TIM   elang ")).toBe("tim elang");
  });
});

describe("detectDelimiter", () => {
  it("mengenali koma, titik koma, dan tab", () => {
    expect(detectDelimiter("a,b,c\nd,e,f")).toBe(",");
    expect(detectDelimiter("a;b;c\nd;e;f")).toBe(";");
    expect(detectDelimiter("a\tb\tc\nd\te\tf")).toBe("\t");
  });
  it("mengabaikan pemisah di dalam tanda kutip dan bawaan koma bila tidak ada pemisah", () => {
    expect(detectDelimiter('"Santoso, Budi";XI;Ketua')).toBe(";");
    expect(detectDelimiter("Tim Elang")).toBe(",");
  });
});

describe("parseMembers: format blok", () => {
  it("membaca dua tim lengkap dengan baris judul kolom", () => {
    const r = parseMembers(BLOCKS);
    expect(r.issues).toEqual([]);
    expect(r.teams.map((t) => t.name)).toEqual(["Tim Elang", "Tim Naga"]);
    expect(r.teams[0].members).toMatchObject([
      { name: "Budi Santoso", className: "XI IPA 1", captain: true },
      { name: "Siti Aminah", className: "XI IPA 2", captain: false },
    ]);
    expect(r.teams[1].members[1]).toMatchObject({
      name: "Fajar Pratama",
      className: "XI IPS 2",
      captain: false,
    });
    expect(r.memberCount).toBe(4);
  });

  it("baris judul kolom boleh tidak ada", () => {
    const r = parseMembers("Tim Elang\nBudi,XI IPA 1,Ketua\nSiti,,\n\nTim Naga\nRina,X IPA 1,Anggota");
    expect(r.issues).toEqual([]);
    expect(r.teams[0].members).toHaveLength(2);
    expect(r.teams[0].members[1]).toMatchObject({ name: "Siti", className: null, captain: false });
  });

  it("nama tim dari spreadsheet berbentuk 'Tim Elang,,' dan baris kosong ',,'", () => {
    const r = parseMembers(
      "Tim Elang,,\nnama,kelas,peran\nBudi,XI IPA 1,Ketua\n,,\nTim Naga,,\nRina,X IPA 1,Ketua",
    );
    expect(r.issues).toEqual([]);
    expect(r.teams.map((t) => t.name)).toEqual(["Tim Elang", "Tim Naga"]);
  });

  it("anggota yang hanya punya nama tidak dianggap nama tim bila langsung di bawah nama tim", () => {
    const r = parseMembers("Tim Elang\nBudi\nSiti");
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].members.map((m) => m.name)).toEqual(["Budi", "Siti"]);
  });

  it("titik koma (Excel lokal Indonesia), tab (hasil salin spreadsheet), BOM, dan CRLF", () => {
    const semi = parseMembers("﻿Tim Elang\r\nnama;kelas;peran\r\nBudi;XI IPA 1;Ketua\r\n");
    expect(semi.issues).toEqual([]);
    expect(semi.delimiter).toBe(";");
    expect(semi.teams[0].members[0]).toMatchObject({ name: "Budi", className: "XI IPA 1", captain: true });
    const tab = parseMembers("Tim Elang\nnama\tkelas\tperan\nBudi\tXI IPA 1\tKetua");
    expect(tab.delimiter).toBe("\t");
    expect(tab.teams[0].members[0].captain).toBe(true);
  });

  it("sel berkutip memuat pemisah dan kutip ganda", () => {
    const r = parseMembers('Tim Elang\n"Santoso, Budi","XI ""IPA"" 1",Ketua');
    expect(r.issues).toEqual([]);
    expect(r.teams[0].members[0]).toMatchObject({
      name: "Santoso, Budi",
      className: 'XI "IPA" 1',
      captain: true,
    });
  });

  it("merapikan spasi ganda dan beberapa baris kosong berturut-turut", () => {
    const r = parseMembers("Tim   Elang\n\n\nBudi   Santoso ,  XI IPA 1 , ketua");
    // baris kosong sebelum 'Budi...' membuatnya terbaca sebagai nama tim bila hanya kolom pertama terisi; di sini ada kelas, jadi anggota
    expect(r.teams[0].name).toBe("Tim Elang");
    expect(r.teams[0].members[0]).toMatchObject({
      name: "Budi Santoso",
      className: "XI IPA 1",
      captain: true,
    });
  });

  it("nomor baris sesuai berkas", () => {
    const r = parseMembers("Tim Elang\nnama,kelas,peran\nBudi,X,Ketua\nBudi,X,Anggota");
    expect(r.issues[0]).toMatchObject({ line: 4, level: "error" });
  });
});

describe("parseMembers: galat dan peringatan", () => {
  it("anggota sebelum nama tim", () => {
    const r = parseMembers("Budi,XI IPA 1,Ketua\nSiti,XI IPA 2,Anggota");
    expect(hasErrors(r)).toBe(true);
    expect(errors(r)[0]).toContain("tidak berada di bawah nama tim");
  });

  it("nama kembar dalam satu tim adalah galat (tanpa membedakan huruf dan spasi)", () => {
    const r = parseMembers("Tim Elang\nBudi Santoso,X,Anggota\nbudi   SANTOSO,X,Anggota");
    expect(errors(r)).toEqual(['"budi SANTOSO" sudah ada di Tim Elang.']);
    expect(r.teams[0].members).toHaveLength(1);
  });

  it("peran tidak dikenal adalah galat (tidak diam-diam jadi Anggota)", () => {
    const r = parseMembers("Tim Elang\nBudi,X,Ketuaa");
    expect(errors(r)[0]).toContain('Peran "Ketuaa" tidak dikenal');
    expect(r.teams[0].members).toHaveLength(0);
  });

  it("nama atau kelas terlalu panjang", () => {
    const r = parseMembers(`Tim Elang\n${"x".repeat(81)},X,Anggota\nBudi,${"k".repeat(41)},Anggota`);
    expect(errors(r)).toHaveLength(2);
  });

  it("nama kosong dengan kelas terisi", () => {
    const r = parseMembers("Tim Elang\n,XI IPA 1,Ketua");
    expect(errors(r)).toEqual(["Nama anggota kosong."]);
  });

  it("lebih dari satu ketua dan tim tanpa anggota hanya peringatan", () => {
    const r = parseMembers("Tim Elang\nBudi,X,Ketua\nSiti,X,Ketua\n\nTim Naga\n");
    expect(hasErrors(r)).toBe(false);
    expect(warnings(r).some((w) => w.includes("2 ketua"))).toBe(true);
    expect(warnings(r).some((w) => w.includes('"Tim Naga" tidak punya anggota'))).toBe(true);
  });

  it("blok tim yang sama muncul dua kali digabung dengan peringatan", () => {
    const r = parseMembers("Tim Elang\nBudi,X,Ketua\n\ntim  elang\nSiti,X,Anggota");
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].members.map((m) => m.name)).toEqual(["Budi", "Siti"]);
    expect(warnings(r)[0]).toContain("digabung");
  });

  it("nama dan kelas sama di dua tim hanya peringatan", () => {
    const r = parseMembers("Tim Elang\nBudi,XI IPA 1,Anggota\n\nTim Naga\nbudi,xi ipa 1,Anggota");
    expect(hasErrors(r)).toBe(false);
    expect(warnings(r)[0]).toContain("juga ada di Tim Elang");
  });

  it("kolom ekstra diabaikan dengan peringatan", () => {
    const r = parseMembers("Tim Elang\nBudi,X,Ketua,08123");
    expect(hasErrors(r)).toBe(false);
    expect(warnings(r)).toEqual(["Kolom setelah peran diabaikan."]);
  });

  it("berkas kosong atau tanpa nama tim", () => {
    expect(errors(parseMembers(""))[0]).toContain("Tidak ada nama tim");
    expect(errors(parseMembers("\n\n  \n"))[0]).toContain("Tidak ada nama tim");
  });

  it("lebih dari 2.000 anggota ditolak", () => {
    const body = Array.from({ length: 2001 }, (_, i) => `Anak ${i + 1},X,Anggota`).join("\n");
    expect(errors(parseMembers(`Tim Elang\n${body}`))[0]).toContain("Terlalu banyak anggota");
  });
});

describe("toImportRows", () => {
  it("meratakan blok jadi baris untuk database dan melewati tim tanpa anggota", () => {
    const r = parseMembers(`${BLOCKS}\nTim Kosong\n`);
    expect(toImportRows(r)).toEqual([
      { team: "Tim Elang", name: "Budi Santoso", class: "XI IPA 1", captain: true },
      { team: "Tim Elang", name: "Siti Aminah", class: "XI IPA 2", captain: false },
      { team: "Tim Naga", name: "Rina Putri", class: "X IPA 1", captain: true },
      { team: "Tim Naga", name: "Fajar Pratama", class: "XI IPS 2", captain: false },
    ]);
  });
});

describe("keluaran CSV", () => {
  it("blok tim bisa dibaca lagi oleh pengurai (bolak-balik), termasuk nama berkoma", () => {
    const csv = teamBlockCsv("Tim Elang", [
      { name: "Santoso, Budi", className: 'XI "IPA" 1', captain: true },
      { name: "Siti", className: null, captain: false },
    ]);
    const r = parseMembers(csv);
    expect(r.issues).toEqual([]);
    expect(r.teams[0].members).toMatchObject([
      { name: "Santoso, Budi", className: 'XI "IPA" 1', captain: true },
      { name: "Siti", className: null, captain: false },
    ]);
  });

  it("templat bisa dibaca pengurai tanpa galat dan memuat dua tim", () => {
    const r = parseMembers(templateCsv());
    expect(r.issues).toEqual([]);
    expect(r.teams.map((t) => t.name)).toEqual(["Tim Elang", "Tim Naga"]);
    expect(templateCsv().startsWith("﻿")).toBe(true);
  });
});
