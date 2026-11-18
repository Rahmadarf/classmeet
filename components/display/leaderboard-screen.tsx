"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScaledStage } from "@/components/display/scaled-stage";
import { usePolling } from "@/lib/hooks/use-polling";
import { fetchLeaderboard, type LeaderboardResult } from "@/lib/display/data";
import type { LeaderRow } from "@/lib/display/view";
import { formatNumber } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** docs/07 §5: layar publik memuat ulang `get_leaderboard()` tiap ±5 detik (tanpa Realtime). */
const POLL_MS = 5_000;
const CARD_H = 160;
const GAP = 16;

/** Warna badge menurut POSISI (bukan tim): 1 kuning, 2 biru muda, 3 oranye, 4–5 abu (DESIGN.md §6). */
const BADGE = ["bg-accent-2", "bg-brand-light", "bg-accent", "bg-rank-gray", "bg-rank-gray"] as const;

/**
 * Layar publik "5 tim teratas" (Figma `Layar publik — 5 tim teratas`, 1084:336; docs/07 §2.4, §3.6).
 * Dua kolom terpisah: badge 1–5 TETAP di tempat, dan kartu tim di sebelahnya bergeser dengan animasi saat urutan
 * berubah (kartu memakai `translateY` menurut posisi; kuncinya id tim). Dibekukan → snapshot dari server tanpa
 * penanda apa pun; disembunyikan → layar tunggu bertema. Tanpa ticker berita, status pasar, atau lencana beku.
 */
export function LeaderboardScreen({
  initial,
  live = true,
}: {
  initial: LeaderboardResult | null;
  live?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [result, setResult] = useState<LeaderboardResult | null>(initial);
  const [offline, setOffline] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!live) return;
    const next = await fetchLeaderboard(supabase);
    if (!mounted.current) return;
    if (next) setResult(next);
    setOffline(next === null);
  }, [supabase, live]);
  usePolling(refresh, POLL_MS);

  return (
    <ScaledStage>
      <div className="flex h-full flex-col gap-4 px-[80px] py-[56px]">
        <header className="flex shrink-0 items-center gap-4 pb-4">
          <div className="bg-accent text-ink-on-accent grid size-14 place-items-center rounded-full text-[30px] font-bold">
            C
          </div>
          <p className="text-ink text-[36px] font-bold">CLASSMEET MARKET</p>
        </header>

        {result === null ? (
          <p className="text-ink-muted mt-24 text-center text-[40px] font-medium">Memuat peringkat…</p>
        ) : result.hidden ? (
          <Waiting />
        ) : (
          <Board rows={result.rows} />
        )}

        <footer className="text-ink-muted mt-auto flex justify-end gap-6 text-[22px]">
          {offline ? <span role="status">Terputus, mencoba menyambung kembali…</span> : null}
          {result && !result.hidden ? <span>Angka dalam rupiah</span> : null}
        </footer>
      </div>
    </ScaledStage>
  );
}

function Board({ rows }: { rows: LeaderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-ink-muted mt-24 text-center text-[40px] font-medium">Belum ada tim terdaftar.</p>
    );
  }
  const height = rows.length * CARD_H + (rows.length - 1) * GAP;
  const stable = [...rows].sort((a, b) => a.teamId.localeCompare(b.teamId));
  return (
    <section aria-label="Lima tim teratas" className="flex shrink-0 gap-6">
      {/* Kolom badge: tetap, tidak ikut bergeser */}
      <ol aria-hidden className="flex shrink-0 flex-col gap-4">
        {rows.map((_, i) => (
          <li key={i} className="grid h-[160px] w-24 place-items-center">
            <span
              className={cn(
                "text-ink-on-accent rounded-control grid size-24 place-items-center text-[56px] font-bold",
                BADGE[i],
              )}
            >
              {i + 1}
            </span>
          </li>
        ))}
      </ol>

      {/* Urutan DOM kartu dibuat STABIL (menurut id tim) dan posisinya diatur lewat translateY. Memindahkan simpul
          DOM akan membatalkan transisi CSS, sehingga kartu tidak akan bergeser halus. */}
      <ol aria-hidden className="relative min-w-0 flex-1" style={{ height }}>
        {stable.map((r) => (
          <li
            key={r.teamId}
            className="board-card border-line bg-card shadow-card rounded-panel absolute inset-x-0 flex h-[160px] items-center gap-[40px] border pr-10 pl-8"
            style={{ transform: `translateY(${rows.indexOf(r) * (CARD_H + GAP)}px)` }}
          >
            <p className="text-ink w-[420px] shrink-0 truncate text-[48px] leading-tight font-bold">
              {r.name}
            </p>
            <div className="flex-1" />
            <Figure label="Total" value={r.total} />
            <Figure label="Saldo" value={r.cash} />
            <Figure label="Nilai aset" value={r.holdings} />
          </li>
        ))}
      </ol>

      {/* Versi untuk pembaca layar: berurutan menurut peringkat. */}
      <ol className="sr-only">
        {rows.map((r, i) => (
          <li key={r.teamId}>
            Peringkat {i + 1}: {r.name}. Total {formatNumber(r.total)}, saldo {formatNumber(r.cash)}, nilai
            aset {formatNumber(r.holdings)} rupiah.
          </li>
        ))}
      </ol>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex w-[330px] shrink-0 flex-col gap-1.5">
      <p className="text-ink-muted text-[22px] font-medium">{label}</p>
      {/* Angka sangat besar (≥ 11 karakter) dikecilkan supaya tetap muat di kolomnya. */}
      <p
        className={cn(
          "tnum text-ink leading-[1.1] font-bold whitespace-nowrap",
          formatNumber(value).length >= 11 ? "text-[46px]" : "text-[56px]",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

/** Layar tunggu bertema saat leaderboard disembunyikan (`leaderboard_hidden`). */
function Waiting() {
  return (
    <section
      aria-label="Peringkat belum dibuka"
      className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
    >
      <p className="text-brand-text text-[28px] font-semibold tracking-[0.16em] uppercase">Papan peringkat</p>
      <p className="text-ink text-[96px] leading-[1.05] font-bold">Segera dibuka</p>
      <p className="text-ink-muted max-w-[1100px] text-[36px]">
        Peringkat akan tampil di sini. Terus berdagang dan kumpulkan hadiah dari pos.
      </p>
    </section>
  );
}
