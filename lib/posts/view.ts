import { postNumber } from "@/lib/history/view";

export type Post = { id: string; name: string; location: string; isOpen: boolean };

export type PostRow = Post & {
  /** "01".."12" dari awalan "Pos N" pada nama; null bila nama tidak bernomor. */
  number: string | null;
  /** Nama tanpa awalan nomor: "Pos 3 · Estafet Balon" → "Estafet Balon". */
  title: string;
};

/** "Pos 3 · Estafet Balon" / "Pos 3 — Estafet Balon" → "Estafet Balon". Nama tanpa awalan dikembalikan apa adanya. */
export function postTitle(name: string): string {
  const stripped = name.replace(/^\s*(?:Pos|Lomba)\s*\d{1,3}\s*[·—–\-:.]?\s*/i, "").trim();
  return stripped || name.trim();
}

/** Urut menurut nomor pos (01, 02, …); yang tak bernomor di belakang, urut menurut nama. */
export function buildPostRows(posts: Post[]): PostRow[] {
  return posts
    .map((p) => ({ ...p, number: postNumber(p.name), title: postTitle(p.name) }))
    .sort((a, b) => {
      if (a.number && b.number) return Number(a.number) - Number(b.number) || a.title.localeCompare(b.title);
      if (a.number) return -1;
      if (b.number) return 1;
      return a.title.localeCompare(b.title);
    });
}

export function countPosts(rows: Post[]): { open: number; closed: number } {
  const open = rows.filter((r) => r.isOpen).length;
  return { open, closed: rows.length - open };
}
