"use client";

import { ArrowLeft } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { formatDateWib, formatTimeWib } from "@/lib/money";
import { paragraphsOf } from "@/lib/team/news-text";
import type { NewsItem } from "@/lib/team/data";

type Ctx = { open: (item: NewsItem) => void };
const NewsReaderContext = createContext<Ctx | null>(null);

/** Buka berita sebagai halaman baca (state saja; URL tidak berubah). Dipakai kartu Berita (Beranda) dan baris berita (Pasar). */
export function useNewsReader(): Ctx {
  const ctx = useContext(NewsReaderContext);
  if (!ctx) throw new Error("useNewsReader harus di dalam <NewsReaderHost>");
  return ctx;
}

/**
 * Menampung isi halaman tim. Saat sebuah berita dibuka, halaman baca menggantikan isi halaman (tanpa mengubah URL dan tanpa
 * pop-up); isi halaman TETAP terpasang (hanya disembunyikan) supaya polling, Realtime, dan pilihan aset tidak hilang.
 * "Kembali" atau Escape menutupnya dan mengembalikan posisi gulir. Isi berita SELALU teks biasa (docs/06 XSS); efek harga
 * tidak pernah tampil.
 */
export function NewsReaderHost({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<NewsItem | null>(null);
  const scroll = useRef(0);
  const open = useCallback((next: NewsItem) => {
    scroll.current = window.scrollY;
    setItem(next);
  }, []);
  const close = useCallback(() => setItem(null), []);

  useEffect(() => {
    if (item) window.scrollTo({ top: 0 });
    else window.scrollTo({ top: scroll.current });
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, close]);

  return (
    <NewsReaderContext.Provider value={{ open }}>
      <div hidden={item !== null}>{children}</div>
      {item ? <NewsPage item={item} onBack={close} /> : null}
    </NewsReaderContext.Provider>
  );
}

function NewsPage({ item, onBack }: { item: NewsItem; onBack: () => void }) {
  return (
    <article aria-labelledby="berita-judul-baca" className="mx-auto flex max-w-[820px] flex-col gap-6 pb-12">
      <button
        type="button"
        onClick={onBack}
        autoFocus
        className="rounded-control text-brand-text hover:bg-soft -ml-3 inline-flex min-h-11 w-fit items-center gap-2 px-3 text-base font-semibold"
      >
        <ArrowLeft className="size-5" aria-hidden />
        Kembali
      </button>
      <header>
        <p className="text-brand-text text-sm font-semibold tracking-[0.12em] uppercase">Berita</p>
        <h1
          id="berita-judul-baca"
          className="text-ink mt-2 text-[36px] leading-[1.15] font-bold tracking-tight"
        >
          {item.title}
        </h1>
        <p className="tnum text-ink-muted mt-3 text-base">
          {formatDateWib(item.publishedAt)} · {formatTimeWib(item.publishedAt)} WIB
        </p>
      </header>
      <div className="bg-line h-px" aria-hidden />
      <div className="flex flex-col gap-6">
        {paragraphsOf(item.body).map((p, i) => (
          <p key={i} className="text-ink text-[21px] leading-[1.75] [overflow-wrap:anywhere]">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
