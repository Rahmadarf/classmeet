import { Chip } from "@/components/ui/chip";
import type { StockLevel } from "@/lib/market/rules";

const COPY: Record<StockLevel, { label: string; tone: "ok" | "accent" | "bad" | "neutral"; dot: string }> = {
  ok: { label: "Stok aman", tone: "ok", dot: "bg-ok-text" },
  mid: { label: "Stok menipis", tone: "accent", dot: "bg-accent-text" },
  low: { label: "Langka", tone: "bad", dot: "bg-bad-text" },
  out: { label: "Stok habis", tone: "bad", dot: "bg-bad-text" },
};

/** Label stok pasar: titik warna + teks (warna bukan satu-satunya penanda). */
export function StockBadge({ level, className }: { level: StockLevel; className?: string }) {
  const c = COPY[level];
  return (
    <Chip tone={c.tone} className={className}>
      <span aria-hidden className={`size-2 rounded-full ${c.dot}`} />
      {c.label}
    </Chip>
  );
}
