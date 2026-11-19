"use client";

import { Newspaper } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DisplayHeader } from "@/components/display/display-header";
import { ScaledStage } from "@/components/display/scaled-stage";
import { fetchNewsBoard, type NewsBoardData } from "@/lib/display/data";
import { usePolling } from "@/lib/hooks/use-polling";
import { dayKeyWib, formatDateWib, formatTimeWib } from "@/lib/money";
import { firstParagraph, paragraphsOf } from "@/lib/team/news-text";
import { createClient } from "@/lib/supabase/client";
import type { NewsItem } from "@/lib/team/data";

const POLL_MS = 5_000;
/** Berita tayang dalam jendela ini diberi lencana "Baru" (sama dengan kartu Berita di halaman tim). */
const FRESH_MS = 30 * 60 * 1000;
/** Jumlah berita sebelumnya di kolom kanan. Layar tidak digulir, jadi jumlahnya tetap. */
const PREVIOUS = 5;

/**
 * Layar publik "Display berita": berita terbaru besar di kiri dan lini masa berita sebelumnya di kanan.
 * Hanya baca, tanpa interaksi. Memuat judul, isi, dan waktu tayang dari `news_feed`; efek harga TIDAK PERNAH ada
 * di sini (tabelnya memang tidak memuatnya). Isi berita selalu teks biasa (tanpa HTML): docs/06 (XSS).
 * Data diambil ulang tiap 5 dtk; jam dihitung di browser.
 */
export function NewsScreen({ initial, live = true }: { initial: NewsBoardData | null; live?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<NewsBoardData | null>(initial);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!live) return;
    const next = await fetchNewsBoard(supabase, PREVIOUS + 1);
    if (!mounted.current) return;
    if (next) setData(next);
    setOffline(next === null);
  }, [supabase, live]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    mounted.current = true;
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      mounted.current = false;
      window.clearTimeout(id);
      window.clearInterval(clock);
    };
  }, []);

  const [latest, ...previous] = data?.news ?? [];

  return (
    <ScaledStage>
      <div className="flex h-full flex-col gap-5 p-10">
        <DisplayHeader state={data?.game.state ?? null} now={now} offline={offline} />

        {data === null ? (
          <p className="text-ink-muted mt-32 text-center text-[40px] font-medium">Memuat berita…</p>
        ) : !latest ? (
          <section
            aria-label="Berita"
            className="border-line bg-card shadow-card rounded-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-5 border"
          >
            <span className="bg-tint text-ink grid size-28 place-items-center rounded-full">
              <Newspaper className="size-14" aria-hidden />
            </span>
            <p className="text-ink text-[44px] font-bold">Belum ada berita</p>
            <p className="text-ink-muted text-[26px]">Berita akan tampil di sini begitu pasar berjalan.</p>
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 gap-5">
            <Featured item={latest} now={now} />
            <Timeline items={previous.slice(0, PREVIOUS)} now={now} />
          </div>
        )}
      </div>
    </ScaledStage>
  );
}

function Featured({ item, now }: { item: NewsItem; now: number | null }) {
  const age = now === null ? null : now - new Date(item.publishedAt).getTime();
  const fresh = age !== null && age <= FRESH_MS;
  return (
    <section
      aria-label="Berita terbaru"
      className="border-line bg-card shadow-card rounded-panel flex min-w-0 flex-[1.45] flex-col gap-7 overflow-hidden border p-12"
    >
      <div className="flex shrink-0 items-center gap-4">
        <span className="bg-tint text-ink grid size-14 place-items-center rounded-full">
          <Newspaper className="size-7" aria-hidden />
        </span>
        <p className="text-brand-text text-[20px] font-semibold tracking-[0.12em] uppercase">
          Berita terbaru
        </p>
        {fresh ? (
          <span className="bg-cyan text-ink-on-accent rounded-full px-4 py-1 text-[18px] font-bold">
            Baru
          </span>
        ) : null}
        <div className="flex-1" />
        <time dateTime={item.publishedAt} className="tnum text-ink-muted text-[22px] font-semibold">
          {timeLabel(item.publishedAt, now)} WIB
        </time>
      </div>

      <h1 className="text-ink shrink-0 text-[64px] leading-[1.12] font-bold [overflow-wrap:anywhere]">
        <span className="line-clamp-3">{item.title}</span>
      </h1>
      <div className="bg-line h-px shrink-0" aria-hidden />
      <div className="text-ink-muted flex min-h-0 flex-col gap-6 text-[29px] leading-[1.5] [overflow-wrap:anywhere]">
        {paragraphsOf(item.body)
          .slice(0, 2)
          .map((p, i) => (
            <p key={i}>
              <span className={i === 0 ? "line-clamp-5" : "line-clamp-4"}>{p}</span>
            </p>
          ))}
      </div>
      <div className="flex-1" />
      {age !== null ? <p className="text-ink-dim shrink-0 text-[22px] font-medium">{agoLabel(age)}</p> : null}
    </section>
  );
}

function Timeline({ items, now }: { items: NewsItem[]; now: number | null }) {
  return (
    <section
      aria-label="Berita sebelumnya"
      className="border-line bg-card shadow-card rounded-panel flex min-w-0 flex-1 flex-col gap-2 overflow-hidden border px-8 py-7"
    >
      <p className="text-brand-text shrink-0 text-[16px] font-semibold tracking-[0.12em] uppercase">
        Sebelumnya
      </p>
      {items.length === 0 ? (
        <p className="text-ink-muted py-6 text-[24px] font-medium">Belum ada berita sebelumnya.</p>
      ) : (
        <ol className="relative flex min-h-0 flex-1 flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-line relative flex min-h-0 flex-1 items-start gap-5 border-t py-4 first:border-t-0"
            >
              <div className="flex w-[104px] shrink-0 flex-col items-start gap-1 pt-1">
                <span className="tnum text-brand-text text-[26px] leading-none font-bold">
                  {formatTimeWib(item.publishedAt)}
                </span>
                <span className="tnum text-ink-dim text-[15px]">{dateLabel(item.publishedAt, now)}</span>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-ink line-clamp-2 text-[26px] leading-tight font-bold [overflow-wrap:anywhere]">
                  {item.title}
                </p>
                <p className="text-ink-muted mt-1.5 line-clamp-2 text-[19px] leading-snug [overflow-wrap:anywhere]">
                  {firstParagraph(item.body)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "10:42" untuk hari ini; "16 Nov · 10:42" untuk hari lain (WIB). */
function timeLabel(iso: string, now: number | null): string {
  const time = formatTimeWib(iso);
  return now === null || dayKeyWib(iso) === dayKeyWib(now) ? time : `${shortDate(iso)} · ${time}`;
}

const shortDate = (iso: string) => formatDateWib(iso).replace(/ \d{4}$/, "");

/** "Hari ini" atau "16 Nov" di bawah jam pada lini masa. */
function dateLabel(iso: string, now: number | null): string {
  return now === null || dayKeyWib(iso) === dayKeyWib(now) ? "Hari ini" : shortDate(iso);
}

/** "Baru saja", "5 menit lalu", "2 jam lalu"; lebih dari sehari tidak ditampilkan. */
function agoLabel(ageMs: number): string {
  const minutes = Math.floor(Math.max(0, ageMs) / 60_000);
  if (minutes < 1) return "Baru saja tayang";
  if (minutes < 60) return `Tayang ${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Tayang ${hours} jam lalu` : `Tayang ${Math.floor(hours / 24)} hari lalu`;
}
