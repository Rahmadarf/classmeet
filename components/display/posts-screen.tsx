"use client";

import { MapPin, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/shell/brand";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatTimeSecondsWib } from "@/lib/money";
import { fetchPosts } from "@/lib/posts/data";
import { countPosts, type PostRow } from "@/lib/posts/view";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Cadangan bila Realtime terlewat (docs/07 §2.1: muat ulang tiap 15 detik). */
const POLL_MS = 15_000;

/**
 * Layar publik tidak boleh digulir (tanpa interaksi), jadi semua ukuran memakai satuan `vh` (tinggi layar) dan
 * kepadatannya mengikuti jumlah pos: ≤ 6 besar, 7–12 sedang (acuan docs/07: 12 pos), 13–16 rapat, > 16 sangat rapat. Dengan begitu
 * seluruh pos muat di layar 768, 900, maupun 1080 px tanpa digulir.
 */
type Density = "large" | "medium" | "small" | "tiny";
const densityFor = (n: number): Density =>
  n <= 6 ? "large" : n <= 12 ? "medium" : n <= 16 ? "small" : "tiny";

const SIZES: Record<
  Density,
  { row: string; tile: string; name: string; place: string; pill: string; title: string }
> = {
  large: {
    row: "gap-[2.6vh] px-[2.6vh] py-[2vh]",
    tile: "size-[10vh] text-[4.4vh]",
    name: "text-[4.2vh]",
    place: "text-[3vh]",
    pill: "px-[2.4vh] py-[1vh] text-[3vh]",
    title: "text-[8vh]",
  },
  medium: {
    row: "gap-[2vh] px-[2vh] py-[0.9vh]",
    tile: "size-[6vh] text-[2.9vh]",
    name: "text-[2.9vh]",
    place: "text-[2.2vh]",
    pill: "px-[1.8vh] py-[0.6vh] text-[2.2vh]",
    title: "text-[5.6vh]",
  },
  small: {
    row: "gap-[1.6vh] px-[1.6vh] py-[0.6vh]",
    tile: "size-[4.8vh] text-[2.3vh]",
    name: "text-[2.3vh]",
    place: "text-[1.8vh]",
    pill: "px-[1.4vh] py-[0.4vh] text-[1.8vh]",
    title: "text-[4.4vh]",
  },
  tiny: {
    row: "gap-[1.4vh] px-[1.4vh] py-[0.4vh]",
    tile: "size-[3.8vh] text-[1.9vh]",
    name: "text-[2vh]",
    place: "text-[1.6vh]",
    pill: "px-[1.2vh] py-[0.3vh] text-[1.6vh]",
    title: "text-[3.8vh]",
  },
};

/**
 * Layar publik "Daftar Pos" (akun `display`; dipindah dari halaman tim). Tanpa interaksi, tanpa sidebar,
 * terbaca dari jauh: ubin nomor besar, nama + lokasi, dan pil status (titik + teks, bukan hanya warna).
 * Berubah lewat Realtime `posts` (RLS terbuka, tabel kecil); polling 15 dtk hanya cadangan.
 * Tidak memuat rentang hadiah (docs/07 §2.1).
 */
export function PostsScreen({
  initial,
  live = true,
}: {
  initial: PostRow[];
  /** false hanya untuk pratinjau /dev (data contoh, tanpa polling/Realtime). */ live?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const dropped = useRef(false);

  const refresh = useCallback(async () => {
    if (!live) return;
    const next = await fetchPosts(supabase);
    if (next) {
      setPosts(next);
      setUpdatedAt(Date.now());
    }
    setOffline(next === null);
  }, [supabase, live]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    // Jam "diperbarui" dihitung di browser, bukan saat render (server dan klien harus sama).
    const id = window.setTimeout(() => setUpdatedAt(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("display-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refresh();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh, live]);

  const { open, closed } = countPosts(posts);
  const z = SIZES[densityFor(posts.length)];

  return (
    <main className="bg-page flex h-dvh flex-col gap-[3vh] overflow-hidden px-[4vw] py-[3.5vh]">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <Brand />
          <div>
            <p className="text-brand-text text-[2.2vh] font-semibold tracking-[0.14em] uppercase">
              Stasiun aktivitas
            </p>
            <h1 className={cn("text-ink leading-[1.05] font-bold tracking-tight", z.title)}>Daftar Pos</h1>
          </div>
        </div>
        <div className="flex items-center gap-4" role="status" aria-label="Ringkasan ketersediaan pos">
          <Count tone="ok" value={open} label="Tersedia" />
          <Count tone="bad" value={closed} label="Tidak tersedia" />
        </div>
      </header>

      <section aria-label="Ketersediaan pos saat ini" className="min-h-0 flex-1">
        {posts.length === 0 ? (
          <p className="text-ink-muted mt-16 text-center text-3xl font-medium">Belum ada pos terdaftar.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-[1.2vh] xl:grid-cols-2 xl:gap-x-[1.6vw]">
            {posts.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "rounded-row shadow-card flex items-center border",
                  z.row,
                  p.isOpen ? "border-ok-text/45 bg-ok/[.09]" : "border-line bg-card",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "rounded-control bg-tint text-ink grid shrink-0 place-items-center font-bold",
                    z.tile,
                  )}
                >
                  {p.number ?? "Pos"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-ink truncate leading-tight font-semibold", z.name)}>{p.title}</p>
                  <p className={cn("text-ink-muted mt-0.5 flex items-center gap-2", z.place)}>
                    <MapPin className="size-[1em] shrink-0" aria-hidden />
                    <span className="truncate">{p.location}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-[0.5em] rounded-full border-2 font-bold whitespace-nowrap",
                    z.pill,
                    p.isOpen
                      ? "border-ok-text bg-card text-ok-text"
                      : "border-bad-text/60 bg-card text-bad-text",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-[0.5em] rounded-full", p.isOpen ? "bg-ok-text" : "bg-bad-text")}
                  />
                  {p.isOpen ? "Tersedia" : "Tidak tersedia"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-ink-muted flex items-center justify-end gap-3 text-[2.2vh]">
        {offline ? (
          <span role="status" className="text-bad-text flex items-center gap-2 font-semibold">
            <WifiOff className="size-[1.2em]" aria-hidden />
            Terputus, mencoba menyambung kembali…
          </span>
        ) : null}
        {updatedAt ? <span className="tnum">Diperbarui {formatTimeSecondsWib(updatedAt)} WIB</span> : null}
      </footer>
    </main>
  );
}

function Count({ tone, value, label }: { tone: "ok" | "bad"; value: number; label: string }) {
  return (
    <div
      className={cn(
        "bg-card flex items-center gap-[1.6vh] rounded-full border-2 py-[1.2vh] pr-[3vh] pl-[2.4vh]",
        tone === "ok" ? "border-ok-text text-ok-text" : "border-bad-text/60 text-bad-text",
      )}
    >
      <span
        aria-hidden
        className={cn("size-[1.6vh] rounded-full", tone === "ok" ? "bg-ok-text" : "bg-bad-text")}
      />
      <span className="tnum text-[5.2vh] leading-none font-bold">{value}</span>
      <span className="text-[3vh] font-semibold">{label}</span>
    </div>
  );
}
