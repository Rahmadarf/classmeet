import { BrandMark } from "@/components/shell/brand-mark";
import { formatTimeWib } from "@/lib/money";
import type { Game } from "@/lib/market/data";
import { cn } from "@/lib/utils";

const STATE_PILL: Record<Game["state"], { text: string; tone: "ok" | "warn" }> = {
  open: { text: "PASAR BUKA", tone: "ok" },
  paused: { text: "PASAR DIJEDA", tone: "warn" },
  setup: { text: "PASAR BELUM DIBUKA", tone: "warn" },
  finished: { text: "PERMAINAN SELESAI", tone: "warn" },
};

/**
 * Bilah atas layar publik 1920×1080 (dipakai Display pasar dan Display berita): merek, peringatan terputus,
 * status pasar (titik + teks, bukan hanya warna), dan jam WIB (kosong sampai terukur di browser).
 */
export function DisplayHeader({
  state,
  now,
  offline,
}: {
  state: Game["state"] | null;
  now: number | null;
  offline: boolean;
}) {
  const pill = state ? STATE_PILL[state] : null;
  return (
    <header className="flex shrink-0 items-center gap-4">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10" />
        <p className="text-ink text-[24px] font-bold">CLASSMEET MARKET</p>
      </div>
      <div className="flex-1" />
      {offline ? (
        <span role="status" className="text-bad-text text-[18px] font-semibold">
          Terputus, mencoba menyambung kembali…
        </span>
      ) : null}
      {pill ? (
        <span
          className={cn(
            "border-line bg-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-bold tracking-[0.06em]",
            pill.tone === "ok" ? "text-ok-text" : "text-accent-text",
          )}
        >
          <span
            aria-hidden
            className={cn("size-3 rounded-full", pill.tone === "ok" ? "bg-ok-text" : "bg-accent")}
          />
          {pill.text}
        </span>
      ) : null}
      <p className="tnum text-ink text-[28px] font-bold">{now ? formatTimeWib(now) : ""}</p>
    </header>
  );
}
