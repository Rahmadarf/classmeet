/** Unduh teks sebagai berkas dari peramban (dipakai templat dan ekspor anggota). Hanya dipanggil dari komponen klien. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nama berkas aman dari nama tim: huruf kecil, angka, dan tanda hubung. */
export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tim"
  );
}
