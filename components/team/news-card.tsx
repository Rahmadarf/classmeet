"use client";

import { ChevronRight, Newspaper } from "lucide-react";
import { EmptyState } from "@/components/states";
import { Card, CardHeader } from "@/components/ui/card";
import { useNewsReader } from "@/components/team/news-reader";
import { firstParagraph } from "@/lib/team/news-text";
import { dayKeyWib, formatDateWib, formatTimeWib } from "@/lib/money";
import type { NewsItem } from "@/lib/team/data";

/** Berita terbaru ditandai "Baru" bila tayang dalam jendela ini (selebihnya jadi berita biasa). */
const FRESH_MS = 30 * 60 * 1000;

/**
 * Kartu Berita di bawah kartu hero (docs/07 §3.0; Figma `Kartu panel` 1082:120).
 * Semua berita yang sudah tayang, terbaru di atas; judul, dua baris isi, waktu WIB. Ketuk baris membuka isi
 * penuh. Isi berita SELALU teks biasa (tanpa HTML): lihat docs/06 (XSS lewat isi berita).
 * Efek harga TIDAK PERNAH tampil di sini (tabel `news_feed` memang tidak memuatnya).
 */
export function NewsCard({ items, now }: { items: NewsItem[]; now: number | null }) {
  const { open: openNews } = useNewsReader();

  return (
    <Card aria-labelledby="berita-judul">
      <CardHeader eyebrow="Tetap terhubung" title={<span id="berita-judul">Berita</span>} className="mb-2" />

      {items.length === 0 ? (
        <EmptyState
          icon={<Newspaper />}
          title="Belum ada berita"
          description="Berita akan muncul di sini begitu pasar berjalan."
        />
      ) : (
        <ul>
          {items.map((item, index) => {
            const fresh =
              index === 0 && now !== null && now - new Date(item.publishedAt).getTime() <= FRESH_MS;
            return (
              <li key={item.id} className="border-line border-t first:border-t-0">
                <button
                  type="button"
                  onClick={() => openNews(item)}
                  className="rounded-row hover:bg-soft flex w-full items-start gap-4 py-3.5 text-left transition-colors"
                >
                  <span
                    aria-hidden
                    className="rounded-control bg-tint text-ink grid size-12 shrink-0 place-items-center"
                  >
                    <Newspaper className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2.5">
                      <span className="text-ink text-lg font-semibold">{item.title}</span>
                      {fresh ? (
                        <span className="bg-cyan text-ink-on-accent rounded-full px-2.5 py-0.5 text-xs font-bold">
                          Baru
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-muted line-clamp-2 text-base">{firstParagraph(item.body)}</span>
                    <time dateTime={item.publishedAt} className="tnum text-ink-dim text-sm">
                      {timeLabel(item.publishedAt, now)}
                    </time>
                  </span>
                  <ChevronRight className="text-ink-muted mt-3 size-[22px] shrink-0" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** "10:42" untuk hari ini; "16 Nov · 10:42" untuk hari lain (WIB). */
function timeLabel(iso: string, now: number | null): string {
  const time = formatTimeWib(iso);
  return now === null || dayKeyWib(iso) === dayKeyWib(now)
    ? time
    : `${formatDateWib(iso).replace(/ \d{4}$/, "")} · ${time}`;
}
