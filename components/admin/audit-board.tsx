"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { fetchAuditPage } from "@/lib/admin/data";
import { FILTERS, type AuditCategory, type AuditRow } from "@/lib/admin/audit";
import { formatDateWib, formatTimeWib } from "@/lib/money";
import { qk } from "@/lib/query/keys";
import { useLivePage } from "@/lib/query/use-live-page";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

const PILL: Record<AuditCategory, string> = {
  hadiah: "bg-cyan/16 text-cyan-text",
  koreksi: "bg-accent/20 text-accent-text",
  status: "bg-tint text-brand-text",
  pos: "bg-ok/16 text-ok-text",
  berita: "bg-soft text-ink",
  aset: "bg-tint text-ink",
  perangkat: "bg-soft text-ink-muted",
  lainnya: "bg-soft text-ink-muted",
};

/**
 * Audit (Figma `Admin — Audit`, 1105:653; docs/07 §2.3): 100 kejadian terakhir yang ditulis fungsi database, hanya
 * baca. Chip filter menyaring menurut jenis aksi (di klien). Isi `alasan` bebas dari pengguna dirender sebagai teks biasa.
 */
export function AuditBoard({ initial }: { initial: AuditRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { data: rows } = useLivePage({
    key: qk.admin("audit"),
    label: "audit",
    initial,
    pollMs: POLL_MS,
    fetch: () => fetchAuditPage(supabase),
  });
  const [filter, setFilter] = useState<"semua" | AuditCategory>("semua");

  const shown = filter === "semua" ? rows : rows.filter((r) => r.category === filter);

  return (
    <Card aria-labelledby="audit-judul" className="flex flex-col gap-3">
      <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Log perubahan</p>
      <h2 id="audit-judul" className="text-ink text-2xl font-bold">
        {rows.length} kejadian terakhir
      </h2>
      <div role="group" aria-label="Filter jenis aksi" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-[15px] font-semibold transition-colors",
              filter === f.key
                ? "border-primary bg-nav-active text-brand-text"
                : "border-line text-ink-muted hover:bg-soft",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        caption="Log perubahan"
        head={["Waktu", "Aksi", "Pelaku", "Ringkasan"]}
        widths={[150, 220, 220]}
        minWidth={900}
      >
        {shown.map((r, i) => {
          const day = formatDateWib(r.at);
          const showDay = i === 0 || day !== formatDateWib(shown[i - 1].at);
          return (
            <tr key={r.id}>
              <td className="tnum text-ink-muted">
                {formatTimeWib(r.at)}
                {showDay ? <span className="block text-xs">{day}</span> : null}
              </td>
              <td>
                <span
                  className={cn(
                    "inline-block rounded-full px-3 py-1 text-[13px] font-semibold",
                    PILL[r.category],
                  )}
                >
                  {r.action}
                </span>
              </td>
              <td className="text-ink">{r.actor}</td>
              <td className="text-ink">{r.summary}</td>
            </tr>
          );
        })}
      </DataTable>
      {shown.length === 0 ? (
        <p className="text-ink-muted py-4 text-center text-base">Tidak ada kejadian untuk filter ini.</p>
      ) : null}
      <p className="text-ink-muted text-sm">
        Hanya fungsi database yang menulis log ini; tidak bisa diubah atau dihapus dari aplikasi. Memuat 100
        kejadian; filter menyaring menurut jenis aksi.
      </p>
    </Card>
  );
}
