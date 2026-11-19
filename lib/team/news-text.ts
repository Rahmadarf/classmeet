/** Pecah isi berita menjadi paragraf (dipisah baris kosong). Isi berita SELALU teks biasa (tanpa HTML): docs/06. */
export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Paragraf pertama saja, untuk pratinjau di daftar. */
export function firstParagraph(body: string): string {
  return paragraphsOf(body)[0] ?? "";
}
