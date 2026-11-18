"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CorrectionDialog } from "@/components/admin/correction-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchPayoutsPage, type PayoutsPage } from "@/lib/admin/data";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatRupiah, formatTimeWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;

/**
 * Hadiah (Figma `Admin — Hadiah`, 1085:576; docs/07 §3.5): HANYA tampilan pengawasan, tanpa persetujuan.
 * 100 hadiah terbaru, total per pos dan per tim, penanda ⚠ bila > 3× rata-rata pos itu (penanda visual, tidak
 * menahan apa pun). "Koreksi saldo" adalah satu-satunya cara membatalkan hadiah yang salah.
 * Realtime `payouts` sebagai pemberitahuan + polling 10 dtk.
 */
export function PayoutsBoard({ initial }: { initial: PayoutsPage }) {
  const supabase = useMemo(() => createClient(), []);
  const [page, setPage] = useState(initial);
  const [stale, setStale] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; teamId: string | null }>({
    open: false,
    teamId: null,
  });
  const dropped = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchPayoutsPage(supabase);
    if (next) setPage(next);
    setStale(next === null);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    const channel = supabase
      .channel("admin-payouts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payouts" }, () => void refresh())
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
  }, [supabase, refresh]);

  return (
    <>
      <PageHeader
        eyebrow="Pengawasan"
        title="Hadiah"
        subtitle="Tampilan saja. Tidak ada persetujuan; salah beri dikoreksi lewat saldo."
        actions={
          <Button variant="secondary" size="lg" onClick={() => setDialog({ open: true, teamId: null })}>
            Koreksi saldo
          </Button>
        }
      />
      {stale ? (
        <p role="status" className="text-ink-muted mb-4 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card aria-labelledby="hadiah-judul" className="flex flex-col gap-1">
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Hadiah terbaru
          </p>
          <h2 id="hadiah-judul" className="text-ink mb-2 text-2xl font-bold">
            100 hadiah terakhir
          </h2>
          {page.rows.length === 0 ? (
            <EmptyState
              title="Belum ada hadiah"
              description="Hadiah yang diberikan penjaga pos muncul di sini."
            />
          ) : (
            <ul>
              {page.rows.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "flex items-center gap-4 border-t px-3 py-4 first:border-t-0",
                    r.outlier ? "bg-accent/12 rounded-row border-transparent" : "border-line",
                  )}
                >
                  <span className="tnum text-ink-muted w-14 shrink-0 text-base">{formatTimeWib(r.at)}</span>
                  <p className="min-w-0 flex-1 truncate text-lg">
                    <button
                      type="button"
                      onClick={() => setDialog({ open: true, teamId: r.teamId })}
                      className="text-ink font-bold hover:underline"
                      aria-label={`Koreksi saldo ${r.teamName}`}
                    >
                      {r.teamName}
                    </button>
                    <span className="text-ink-muted">
                      {" "}
                      ← {r.postName} ({r.guardName})
                    </span>
                  </p>
                  {r.outlier ? (
                    <span className="border-accent-text text-accent-text bg-card inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      3× rata-rata pos
                    </span>
                  ) : null}
                  <span className="money text-ink w-44 shrink-0 text-right text-xl font-bold whitespace-nowrap">
                    {formatRupiah(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Totals title="Total per pos" rows={page.perPost} />
          <Totals title="Total per tim" rows={page.perTeam} />
        </div>
      </div>

      <CorrectionDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        teams={page.teams}
        teamId={dialog.teamId}
        onDone={() => {
          toast.success("Koreksi saldo tersimpan.");
          void refresh();
        }}
      />
    </>
  );
}

function Totals({ title, rows }: { title: string; rows: { name: string; total: number }[] }) {
  return (
    <Card className="flex flex-col gap-2 p-6">
      <h2 className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-muted text-base">Belum ada.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.name}
              className="border-line flex items-center justify-between gap-3 border-t py-3 first:border-t-0"
            >
              <span className="text-ink-muted min-w-0 text-lg leading-tight break-words">{r.name}</span>
              <span className="money text-ink shrink-0 text-lg font-bold">{formatRupiah(r.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
