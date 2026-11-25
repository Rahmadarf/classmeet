import { describe, expect, it } from "vitest";
import { buildPostRows, countPosts, postTitle } from "./view";

const p = (id: string, name: string, isOpen = false) => ({ id, name, location: "Aula", isOpen });

describe("postTitle", () => {
  it("membuang awalan nomor", () => {
    expect(postTitle("Pos 3 · Estafet Balon")).toBe("Estafet Balon");
    expect(postTitle("Pos 12 — Lempar Cincin")).toBe("Lempar Cincin");
    expect(postTitle("Pos 7: Susun Menara")).toBe("Susun Menara");
    expect(postTitle("Lompat Tali")).toBe("Lompat Tali");
    expect(postTitle("Pos 5")).toBe("Pos 5"); // tak ada judul tersisa → apa adanya
    expect(postTitle("Lomba 2 · Futsal Antarkelas")).toBe("Futsal Antarkelas");
  });
});

describe("buildPostRows", () => {
  it("mengurutkan menurut nomor (bukan abjad) dan menaruh yang tak bernomor di belakang", () => {
    const rows = buildPostRows([
      p("a", "Pos 10 · J"),
      p("b", "Zebra"),
      p("c", "Pos 2 · B"),
      p("d", "Pos 1 · A"),
    ]);
    expect(rows.map((r) => [r.number, r.title])).toEqual([
      ["01", "A"],
      ["02", "B"],
      ["10", "J"],
      [null, "Zebra"],
    ]);
  });
});

describe("countPosts", () => {
  it("menghitung tersedia dan tidak tersedia", () => {
    expect(countPosts([p("a", "x", true), p("b", "y"), p("c", "z")])).toEqual({ open: 1, closed: 2 });
  });
});
