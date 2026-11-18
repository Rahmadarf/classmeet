import { cva, type VariantProps } from "class-variance-authority";
import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";
import { formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Chip: bentuk pil bulat penuh. Isian aksen pada 14–16 % + teks varian gelap (DESIGN.md §3.3, §6).
 * Warna tidak pernah satu-satunya penanda: naik/turun memakai ikon panah dan tanda +/−.
 */
export const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border border-line bg-card text-ink-muted",
        up: "bg-cyan/16 text-cyan-text",
        down: "bg-bad/16 text-bad-text",
        ok: "border border-ok-text/40 bg-ok/16 text-ok-text",
        bad: "border border-bad-text/40 bg-bad/16 text-bad-text",
        accent: "bg-accent/20 text-accent-text",
        brand: "bg-tint text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

/** Perubahan harga: ▲ +3,0 % / ▼ −5,0 % (ikon + tanda, bukan hanya warna). */
export function PriceChangeChip({
  pct,
  suffix,
  className,
}: {
  pct: number | null;
  /** Tambahan di belakang persen, mis. "+22.500" (selisih rupiah). */
  suffix?: string;
  className?: string;
}) {
  if (pct === null || Number.isNaN(pct)) {
    return (
      <Chip tone="neutral" className={cn("tnum", className)}>
        –
      </Chip>
    );
  }
  const up = pct > 0;
  const down = pct < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : null;
  return (
    <Chip tone={up ? "up" : down ? "down" : "neutral"} className={cn("tnum", className)}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      <span>{formatPercent(pct)}</span>
      {suffix ? <span>· {suffix}</span> : null}
      <span className="sr-only">{up ? "naik" : down ? "turun" : "tidak berubah"}</span>
    </Chip>
  );
}

/** Pil status pos / koneksi: titik berwarna + teks. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "ok" | "bad";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Chip tone={tone} className={className}>
      <span aria-hidden className={cn("size-2 rounded-full", tone === "ok" ? "bg-ok-text" : "bg-bad-text")} />
      {children}
    </Chip>
  );
}
