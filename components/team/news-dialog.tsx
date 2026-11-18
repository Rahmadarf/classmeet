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
      <DialogContent
        // Latar abu-abu buram (bukan biru) supaya teks berita jadi fokus; kotak dan huruf lebih besar dari dialog biasa.
        overlayClassName="bg-neutral-500/35 backdrop-blur-md"
        className="max-h-[88dvh] w-[min(760px,94vw)] p-8 sm:p-10"
      >
        {item ? (
          <>
            <p className="text-brand-text text-sm font-semibold tracking-[0.12em] uppercase">Berita</p>
            <DialogTitle className="text-ink mt-2 pr-12 text-[32px] leading-tight font-bold">
              {item.title}
            </DialogTitle>
            <DialogDescription className="tnum text-ink-muted mt-2 text-base">
              {formatDateWib(item.publishedAt)} · {formatTimeWib(item.publishedAt)} WIB
            </DialogDescription>
            <p className="text-ink mt-6 text-[22px] leading-[1.7] whitespace-pre-line">{item.body}</p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
