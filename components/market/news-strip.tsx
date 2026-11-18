"use client";

import { ChevronRight, Newspaper } from "lucide-react";
import { useState } from "react";
import { NewsDialog } from "@/components/team/news-dialog";
import type { NewsItem } from "@/lib/team/data";

/**
 * Berita terbaru satu baris (Figma `Berita terbaru`, 1082:220). Ketuk membuka isi penuh. Efek harga
 * tidak pernah tampil (tabel `news_feed` memang tidak memuatnya).
 */
export function NewsStrip({ latest }: { latest: NewsItem | null }) {
  const [open, setOpen] = useState<NewsItem | null>(null);
  const body = (
    <>
      <Newspaper className="text-accent-text size-[22px] shrink-0" aria-hidden />
      <span className="text-brand-text shrink-0 text-xs font-semibold tracking-[0.12em] uppercase">
        Berita terbaru
      </span>
      <span className="text-ink min-w-0 flex-1 truncate text-lg font-semibold">
        {latest ? latest.title : "Belum ada berita"}
      </span>
    </>
  );

  return (
    <>
      {latest ? (
        <button
          type="button"
          onClick={() => setOpen(latest)}
          className="rounded-panel border-line bg-card shadow-card hover:bg-soft flex min-h-14 w-full items-center gap-3.5 border px-5 py-3.5 text-left transition-colors"
        >
          {body}
          <ChevronRight className="text-ink-muted size-[22px] shrink-0" aria-hidden />
        </button>
      ) : (
        <div className="rounded-panel border-line bg-card shadow-card flex min-h-14 w-full items-center gap-3.5 border px-5 py-3.5">
          {body}
        </div>
      )}
      <NewsDialog item={open} onClose={() => setOpen(null)} />
    </>
  );
}
