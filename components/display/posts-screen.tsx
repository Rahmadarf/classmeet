"use client";

import { MapPin, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScaledStage } from "@/components/display/scaled-stage";
import { Brand } from "@/components/shell/brand";
import { AREA_H, cardOffset, zoneLayout } from "@/lib/display/posts-layout";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatTimeSecondsWib } from "@/lib/money";
import { fetchPosts } from "@/lib/posts/data";
import { countPosts, type PostRow } from "@/lib/posts/view";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Cadangan bila Realtime terlewat (docs/07 §2.1: muat ulang tiap 15 detik). */
const POLL_MS = 15_000;
/** Pos yang baru berganti status diberi penanda "Baru" selama ini. */
const FRESH_MS = 90_000;

// Geometri panggung 1920×1080 (px). Zona: kiri Tersedia, kanan Tidak tersedia.
const PAD = 40;
const ZONE_TOP = 160;
const ZONE_W = 908;
const ZONE_H = 880;
const ZONE_GAP = 24;
const AREA_PAD = 28;
const AREA_TOP = 190; // tinggi kepala zona sebelum area kartu

type ZoneKey = "open" | "closed";
const ZONES: Record<ZoneKey, { label: string; hint: string; empty: string; left: number }> = {
  open: {
    label: "Tersedia",
    hint: "Masih kurang tim atau belum ada tim untuk memulai permainan",
    empty: "Tidak ada pos tersedia",
    left: PAD,
  },
  closed: {
    label: "Tidak tersedia",
    hint: "Pos penuh atau permainan sedang dimulai",
    empty: "Semua pos sedang tersedia",
    left: PAD + ZONE_W + ZONE_GAP,
  },
};

/**
 * Layar publik "Daftar Pos" dua zona (akun `display`): kiri **Tersedia** (masih kurang tim / belum ada tim untuk memulai),
 * kanan **Tidak tersedia** (penuh / permainan sedang dimulai), masing-masing dengan angka hitungan besar. Tanpa interaksi
 * dan tanpa gulir (panggung 1920×1080 yang diskalakan). Tiap pos satu kartu yang DOM-nya stabil menurut id dan posisinya
 * lewat `transform`, jadi saat penjaga mengubah status, kartunya meluncur ke zona lain; pos yang baru berganti status
 * diberi penanda "Baru" selama 90 detik. Status selalu teks (nama zona) dan bukan hanya warna. Berubah lewat Realtime
 * `posts` (RLS terbuka, tabel kecil); polling 15 dtk hanya cadangan. Tidak memuat rentang hadiah (docs/07 §2.1).
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
  const [now, setNow] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const [offline, setOffline] = useState(false);
  const dropped = useRef(false);
  const prev = useRef(new Map(initial.map((p) => [p.id, p.isOpen])));

  const refresh = useCallback(async () => {
    if (!live) return;
    const next = await fetchPosts(supabase);
    if (next) {
      const changed: Record<string, number> = {};
      for (const p of next) {
        const before = prev.current.get(p.id);
        if (before !== undefined && before !== p.isOpen) changed[p.id] = Date.now();
      }
      prev.current = new Map(next.map((p) => [p.id, p.isOpen]));
      if (Object.keys(changed).length > 0) setFresh((f) => ({ ...f, ...changed }));
      setPosts(next);
      setUpdatedAt(Date.now());
    }
    setOffline(next === null);
  }, [supabase, live]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    // Jam dihitung di browser, bukan saat render (server dan klien harus sama).
    const id = window.setTimeout(() => {
      setUpdatedAt(Date.now());
      setNow(Date.now());
    }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(tick);
    };
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
  const byZone: Record<ZoneKey, PostRow[]> = {
    open: posts.filter((p) => p.isOpen),
    closed: posts.filter((p) => !p.isOpen),
  };
  const layout = { open: zoneLayout(byZone.open.length), closed: zoneLayout(byZone.closed.length) };
  // DOM stabil menurut id; posisi menurut urutan nomor di zona masing-masing.
  const cards = [...posts].sort((a, b) => a.id.localeCompare(b.id));

  const place = (p: PostRow) => {
    const zone: ZoneKey = p.isOpen ? "open" : "closed";
    const list = byZone[zone];
    const l = layout[zone];
    const { x, y } = cardOffset(l, list.indexOf(p));
    return {
      zone,
      l,
      left: ZONES[zone].left + AREA_PAD + x,
      top: ZONE_TOP + AREA_TOP + y,
    };
  };

  return (
    <ScaledStage>
      <div className="relative h-full w-full">
        <header
          className="absolute flex items-end justify-between"
          style={{ left: PAD, right: PAD, top: PAD, height: 96 }}
        >
          <div className="flex items-center gap-8">
            <Brand />
            <div className="bg-line h-14 w-px" aria-hidden />
            <div>
              <p className="text-brand-text text-[18px] font-semibold tracking-[0.14em] uppercase">
                Stasiun aktivitas
              </p>
              <h1 className="text-ink text-[52px] leading-[1.05] font-bold tracking-tight">Daftar Pos</h1>
            </div>
          </div>
          <div className="text-ink-muted flex items-center gap-4 pb-1 text-[22px]">
            {offline ? (
              <span role="status" className="text-bad-text flex items-center gap-2 font-semibold">
                <WifiOff className="size-[1.2em]" aria-hidden />
                Terputus, mencoba menyambung kembali…
              </span>
            ) : null}
            {updatedAt ? (
              <span className="tnum">Diperbarui {formatTimeSecondsWib(updatedAt)} WIB</span>
            ) : null}
          </div>
        </header>

        {posts.length === 0 ? (
          <p className="text-ink-muted absolute inset-x-0 top-[420px] text-center text-[40px] font-medium">
            Belum ada pos terdaftar.
          </p>
        ) : (
          <>
            {(["open", "closed"] as const).map((key) => {
              const z = ZONES[key];
              const count = key === "open" ? open : closed;
              const isOpen = key === "open";
              return (
                <section
                  key={key}
                  aria-label={`Pos ${z.label.toLowerCase()}: ${count}`}
                  className={cn(
                    "rounded-panel shadow-card absolute border",
                    isOpen ? "border-ok-text/45 bg-ok/[.07]" : "border-line bg-card",
                  )}
                  style={{ left: z.left, top: ZONE_TOP, width: ZONE_W, height: ZONE_H }}
                >
                  <div className="flex items-center gap-8 px-8 pt-8" style={{ height: AREA_TOP }}>
                    <span
                      className={cn(
                        "tnum text-[132px] leading-none font-bold",
                        isOpen ? "text-ok-text" : "text-bad-text",
                      )}
                    >
                      {count}
                    </span>
                    <div className="min-w-0">
                      <p className="text-ink flex items-center gap-4 text-[50px] leading-tight font-bold">
                        <span
                          aria-hidden
                          className={cn("size-[22px] rounded-full", isOpen ? "bg-ok-text" : "bg-bad-text")}
                        />
                        {z.label}
                      </p>
                      <p className="text-ink-muted mt-1 text-[24px] leading-snug">{z.hint}</p>
                    </div>
                  </div>
                  {count === 0 ? (
                    <div
                      className="text-ink-muted border-line absolute grid place-items-center rounded-[16px] border-2 border-dashed text-[30px] font-medium"
                      style={{ left: AREA_PAD, right: AREA_PAD, top: AREA_TOP, height: AREA_H }}
                    >
                      {z.empty}
                    </div>
                  ) : null}
                </section>
              );
            })}

            {/* Kartu: satu elemen per pos, berpindah antar zona lewat transform. Disembunyikan dari teknologi bantu; daftar bacaan ada di bawah. */}
            <ul aria-hidden>
              {cards.map((p) => {
                const { zone, l, left, top } = place(p);
                const isFresh = now !== null && fresh[p.id] !== undefined && now - fresh[p.id] < FRESH_MS;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "rounded-row shadow-card bg-card absolute flex items-center border px-[16px]",
                      "transition-[transform,width,height,box-shadow] duration-[800ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
                      zone === "open" ? "border-ok-text/45" : "border-line",
                      isFresh && "ring-accent ring-4",
                    )}
                    style={{
                      width: l.cardW,
                      height: l.cardH,
                      gap: Math.round(l.cardH * 0.18),
                      transform: `translate(${left}px, ${top}px)`,
                    }}
                  >
                    <span
                      className="rounded-control bg-tint text-ink grid shrink-0 place-items-center font-bold"
                      style={{ width: l.tile, height: l.tile, fontSize: Math.round(l.tile * 0.46) }}
                    >
                      {p.number ?? "Pos"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-ink truncate leading-tight font-semibold"
                        style={{ fontSize: l.name }}
                      >
                        {p.title}
                      </p>
                      {l.showPlace ? (
                        <p
                          className="text-ink-muted mt-0.5 flex items-center gap-2"
                          style={{ fontSize: l.place }}
                        >
                          <MapPin className="size-[1em] shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </p>
                      ) : null}
                    </div>
                    {isFresh ? (
                      <span
                        className="bg-cyan text-ink-on-accent shrink-0 rounded-full font-bold"
                        style={{
                          fontSize: Math.max(14, Math.round(l.cardH * 0.2)),
                          padding: "0.2em 0.7em",
                        }}
                      >
                        Baru
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {(["open", "closed"] as const).map((key) => (
              <section
                key={key}
                className="sr-only"
                aria-label={`Daftar pos ${ZONES[key].label.toLowerCase()}`}
              >
                <ol>
                  {byZone[key].map((p) => (
                    <li
                      key={p.id}
                    >{`${p.number ? `Pos ${p.number}: ` : ""}${p.title}, ${p.location}, ${ZONES[key].label}`}</li>
                  ))}
                </ol>
              </section>
            ))}
          </>
        )}
      </div>
    </ScaledStage>
  );
}
