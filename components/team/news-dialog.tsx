"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDateWib, formatTimeWib } from "@/lib/money";
import type { NewsItem } from "@/lib/team/data";

/**
 * Isi lengkap satu berita (dipakai kartu Berita di Beranda dan baris berita di Pasar).
 * Isi berita SELALU teks biasa (tanpa HTML): lihat docs/06 (XSS lewat isi berita). Tanpa efek harga.
 */
export function NewsDialog({ item, onClose }: { item: NewsItem | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {item ? (
          <>
            <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Berita</p>
            <DialogTitle className="text-ink mt-1 pr-12 text-2xl leading-tight font-semibold">
              {item.title}
            </DialogTitle>
            <DialogDescription className="tnum text-ink-dim mt-1 text-sm">
              {formatDateWib(item.publishedAt)} · {formatTimeWib(item.publishedAt)} WIB
            </DialogDescription>
            <p className="text-ink mt-4 text-lg leading-[1.6] whitespace-pre-line">{item.body}</p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
