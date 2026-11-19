"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { NewsEffects, type EffectRow, type EventRow } from "@/components/admin/news-effects";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { AppliedNews } from "@/lib/admin/data";
import { dayKeyWib, formatDateWib, formatTimeWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const EVENT_LABEL = { bankrupt: "Bangkrut", dividend: "Dividen", suspend: "Suspensi" } as const;

/** "10:42" untuk hari ini; "18 Nov · 10:42" untuk hari lain (WIB). */
function stamp(iso: string | null, nowMs: number | null): string {
  if (!iso) return "–";
  const time = formatTimeWib(iso);
  return nowMs !== null && dayKeyWib(iso) === dayKeyWib(nowMs)
    ? time
    : `${formatDateWib(iso).replace(/ \d{4}$/, "")} · ${time}`;
}

/**
 * Riwayat berita yang SUDAH berlaku ke publik (sudah diterapkan ke harga), terbaru dulu. Hanya yang sudah terjadi:
 * berita yang belum berlaku tidak ada di sini. Buka satu berita untuk melihat aset dan persen perubahannya.
 */
export function NewsHistory({ items }: { items: AppliedNews[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Card aria-labelledby="riwayat-berita" className="flex flex-col gap-2">
      <h2
        id="riwayat-berita"
        className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase"
      >
        Riwayat berita yang sudah berlaku
      </h2>
      <p className="tnum text-ink text-lg font-semibold">{items.length} berita</p>
      {items.length === 0 ? (
        <p className="text-ink-muted text-base">Belum ada berita yang berlaku.</p>
      ) : (
        <ul className="max-h-[560px] overflow-y-auto">
          {items.map((n) => {
            const isOpen = open === n.id;
            return (
              <li key={n.id} className="border-line border-t first:border-t-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : n.id)}
                  className="rounded-row hover:bg-soft flex w-full items-start gap-3 py-3 text-left transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block text-base leading-snug font-semibold">{n.title}</span>
                    <span className="tnum text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span>Terbit {stamp(n.publishedAt, now)}</span>
                      <span>Berlaku {stamp(n.appliedAt, now)}</span>
                      <span>{n.assets} aset</span>
                      {n.event ? (
                        <Chip
                          tone={n.event.kind === "bankrupt" ? "down" : "neutral"}
                          className="text-xs font-semibold"
                        >
                          {EVENT_LABEL[n.event.kind]} {n.event.symbol}
                        </Chip>
                      ) : null}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-ink-muted mt-1 size-5 shrink-0 transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <div className="bg-field rounded-row mb-3 px-4 py-3">
                    <AppliedEffects newsId={n.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Efek satu berita yang sudah berlaku (`admin_news_effects`), dimuat saat dibuka. */
function AppliedEffects({ newsId }: { newsId: string }) {
  const [data, setData] = useState<{ effects: EffectRow[]; events: EventRow[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc("admin_news_effects", { p_news_id: newsId })
      .then(({ data: rows, error: err }) => {
        if (!alive) return;
        if (err || !rows) return setError(true);
        setData({
          effects: rows
            .filter((r) => r.kind === "effect")
            .map((r) => ({ symbol: r.symbol, name: r.name, pct: r.value / 100 })),
          events: rows.flatMap((r): EventRow[] =>
            r.kind === "bankrupt" || r.kind === "dividend" || r.kind === "suspend"
              ? [{ kind: r.kind, symbol: r.symbol, name: r.name, value: r.value }]
              : [],
          ),
        });
      });
    return () => {
      alive = false;
    };
  }, [newsId]);
  if (error) return <p className="text-bad-text text-sm">Efek belum bisa dimuat.</p>;
  if (!data) return <p className="text-ink-muted text-sm">Memuat efek…</p>;
  return <NewsEffects effects={data.effects} events={data.events} />;
}
