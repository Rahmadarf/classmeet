import { Clock, PauseCircle } from "lucide-react";
import type { GameState } from "@/lib/market/data";

const COPY: Record<Exclude<GameState, "open">, { label: string; text: string }> = {
  setup: {
    label: "Pasar belum dibuka",
    text: "Panitia belum membuka pasar. Kamu bisa melihat data, tetapi belum bisa memasang order.",
  },
  paused: {
    label: "Pasar dijeda",
    text: "Panitia menjeda pasar. Order baru dan pembatalan tidak bisa dilakukan; order terbuka tetap antre.",
  },
  finished: {
    label: "Permainan selesai",
    text: "Pasar sudah ditutup. Order terbuka telah dibatalkan dan tidak ada order baru.",
  },
};

/** Banner status pasar di atas papan (docs/07 §4; Figma `Pasar dijeda`, 1129:612). Tidak tampil saat pasar buka. */
export function MarketStateBanner({ state }: { state: GameState }) {
  if (state === "open") return null;
  const copy = COPY[state];
  return (
    <div
      role="status"
      className="rounded-panel border-accent bg-accent/12 text-ink flex min-h-14 items-center gap-3.5 border px-5 py-3.5"
    >
      {state === "paused" ? (
        <PauseCircle className="text-accent-text size-[22px] shrink-0" aria-hidden />
      ) : (
        <Clock className="text-accent-text size-[22px] shrink-0" aria-hidden />
      )}
      <p className="min-w-0 flex-1 text-lg font-semibold">
        <span className="text-accent-text mr-3 text-xs font-bold tracking-[0.12em] uppercase">
          {copy.label}
        </span>
        {copy.text}
      </p>
    </div>
  );
}
