"use client";

import { BrandMark } from "@/components/shell/brand-mark";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ScaledStage } from "@/components/display/scaled-stage";
import { usePolling } from "@/lib/hooks/use-polling";
import { fetchGame, type Game } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/client";

/** Status game dicek tiap 5 detik; saat `setup` semua layar publik tertutup tulisan "Game belum di mulai". */
const POLL_MS = 5_000;

/**
 * Pembungkus semua layar publik (peringkat, pasar, berita, pos, dan layar bergilir). Selama status game `setup`
 * (sebelum dimulai atau sesudah reset) isi layar ditutup satu tulisan besar; layar di bawahnya tetap terpasang
 * sehingga langsung tampil begitu game dimulai. `initialState` dari server supaya tidak ada kedipan.
 */
export function DisplayGate({
  initialState,
  children,
}: {
  initialState: Game["state"] | null;
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState);
  const refresh = useCallback(async () => {
    const g = await fetchGame(supabase);
    if (g) setState(g.state);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  return (
    <>
      {children}
      {state === "setup" ? (
        <div role="status" className="bg-page fixed inset-0 z-50" aria-label="Game belum dimulai">
          <ScaledStage>
            <div className="flex h-full flex-col px-[80px] py-[56px]">
              <header className="flex shrink-0 items-center gap-4">
                <BrandMark className="h-14" />
                <p className="text-ink text-[36px] font-bold">CLASSMEET MARKET</p>
              </header>
              <div className="flex flex-1 flex-col items-center justify-center gap-[56px]">
                <p className="text-ink max-w-[1500px] text-center text-[240px] leading-[1.02] font-extrabold text-balance">
                  Game belum di mulai
                </p>
                <div className="text-ink-muted flex items-center gap-[28px]">
                  <span
                    aria-hidden
                    className="border-line-strong border-t-primary size-[56px] animate-spin rounded-full border-[7px] motion-reduce:animate-none"
                  />
                  <p className="text-[56px] font-medium">Menunggu panitia memulai</p>
                </div>
              </div>
            </div>
          </ScaledStage>
        </div>
      ) : null}
    </>
  );
}
