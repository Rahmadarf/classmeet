"use client";

import { useEffect, useState } from "react";
import { Chip, PriceChangeChip } from "@/components/ui/chip";
import { formatPercent } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

export type EffectRow = { symbol: string; name: string; pct: number };
export type EventRow = {
  kind: "bankrupt" | "dividend" | "suspend";
  symbol: string;
  name: string;
  value: number;
};

/** Teks event untuk admin: "Dividen AP · 1,5 % harga acuan per unit", "Suspensi XI · 9 menit", "Bangkrut LO · unit diganti 19 %". */
export function eventText(e: EventRow): string {
  if (e.kind === "dividend")
    return `Dividen ${e.symbol} (${e.name}) · ${formatPercent(e.value / 100, 2).replace("+", "")} harga acuan per unit`;
  if (e.kind === "suspend") return `Suspensi ${e.symbol} (${e.name}) · ${e.value} menit`;
  return `Bangkrut ${e.symbol} (${e.name}) · unit diganti ${formatPercent(e.value / 100, 0).replace("+", "")} harga acuan`;
}

/**
 * Aset yang berubah harganya oleh satu berita dan seberapa persen: dua kolom "Naik" dan "Turun" (urut dari yang paling
 * besar), plus event bila ada. Persen dari `news_effects` (bps / 100); tanda dan panah, bukan hanya warna.
 */
export function NewsEffects({ effects, events = [] }: { effects: EffectRow[]; events?: EventRow[] }) {
  const up = effects.filter((e) => e.pct > 0).sort((a, b) => b.pct - a.pct);
  const down = effects.filter((e) => e.pct < 0).sort((a, b) => a.pct - b.pct);
  const column = (title: string, rows: EffectRow[]) => (
    <div className="min-w-0 flex-1">
      <p className="text-ink-muted mb-1 text-sm font-semibold">
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="text-ink-muted text-sm">–</p>
      ) : (
        <ul>
          {rows.map((e) => (
            <li
              key={e.symbol}
              className="border-line flex items-center gap-3 border-t py-1.5 first:border-t-0"
            >
              <span className="text-brand-text w-12 shrink-0 text-base font-bold">{e.symbol}</span>
              <span className="text-ink min-w-0 flex-1 truncate text-base">{e.name}</span>
              <PriceChangeChip pct={e.pct} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      {events.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Event pada berita ini">
          {events.map((e) => (
            <li key={`${e.kind}-${e.symbol}`}>
              <Chip tone={e.kind === "bankrupt" ? "down" : "neutral"} className="text-sm font-semibold">
                {eventText(e)}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-6 md:flex-row">
        {column("Naik", up)}
        {column("Turun", down)}
      </div>
    </div>
  );
}

/** Efek satu berita draf, dimuat saat dibuka (admin boleh membaca `news_effects` hanya SEBELUM game dibuka). */
export function DraftEffects({ newsId }: { newsId: string }) {
  const [rows, setRows] = useState<EffectRow[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void createClient()
      .from("news_effects")
      .select("pct_bps,assets(symbol,name)")
      .eq("news_id", newsId)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data) return setError(true);
        setRows(
          data.flatMap((r) => {
            const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
            return a ? [{ symbol: a.symbol, name: a.name, pct: r.pct_bps / 100 }] : [];
          }),
        );
      });
    return () => {
      alive = false;
    };
  }, [newsId]);
  if (error) return <p className="text-bad-text text-sm">Efek belum bisa dimuat.</p>;
  if (!rows) return <p className="text-ink-muted text-sm">Memuat efek…</p>;
  return <NewsEffects effects={rows} />;
}

/** Ringkasan yang bisa dibuka: efek baru dimuat saat dibuka supaya ratusan berita draf tidak memuat sekaligus. */
export function DraftEffectsToggle({ newsId }: { newsId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-1" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="text-brand-text cursor-pointer text-sm font-semibold">
        Lihat aset dan persen perubahannya
      </summary>
      <div className="mt-2">{open ? <DraftEffects newsId={newsId} /> : null}</div>
    </details>
  );
}
