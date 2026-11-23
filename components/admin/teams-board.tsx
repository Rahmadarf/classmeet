"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CorrectionDialog } from "@/components/admin/correction-dialog";
import { TeamCreateDialog } from "@/components/admin/team-create-dialog";
import { TeamQrDialog } from "@/components/admin/team-qr-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { fetchTeamsPage, type TeamRow } from "@/lib/admin/data";
import { formatRupiah } from "@/lib/money";
import { qk } from "@/lib/query/keys";
import { useLivePage } from "@/lib/query/use-live-page";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;

/** Warna lencana menurut posisi: 1 emas, 2 biru muda, 3 oranye, 4+ abu-abu (docs/07 §2.3). */
const RANK = ["bg-accent-2", "bg-brand-light", "bg-accent"] as const;

/**
 * Tim (Figma `Admin — Tim`, 1104:660): peringkat langsung semua tim (`get_leaderboard()` untuk admin selalu data
 * langsung, bukan snapshot), saldo, nilai aset (harga peringkat), total; Koreksi saldo (dialog) dan Lihat QR (dialog
 * kartu QR + unduh PNG, tampilan sama dengan dialog "Tambah tim"; menggantikan tombol "Ganti QR" lama).
 */
export function TeamsBoard({ initial }: { initial: TeamRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const {
    data: rows,
    stale,
    refresh,
  } = useLivePage({
    key: qk.admin("teams"),
    label: "teams",
    initial,
    pollMs: POLL_MS,
    fetch: () => fetchTeamsPage(supabase),
  });
  const [correct, setCorrect] = useState<string | null>(null);
  const [qrTeam, setQrTeam] = useState<TeamRow | null>(null);
  const [creating, setCreating] = useState(false);

  const teams = rows.map((r) => ({ id: r.teamId, name: r.name, cash: r.freeCash }));

  return (
    <>
      {stale ? (
        <p role="status" className="text-ink-muted mb-4 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}
      <Card aria-labelledby="tim-judul" className="flex flex-col gap-2">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Peringkat langsung
        </p>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 id="tim-judul" className="text-ink text-2xl font-bold">
            {rows.length} tim
          </h2>
          <Button onClick={() => setCreating(true)}>Tambah tim</Button>
        </div>
        <DataTable
          caption="Peringkat langsung semua tim"
          head={["#", "Tim", "Saldo", "Nilai aset (harga tayang)", "Total", ""]}
          widths={[72, 220, 150, 230, 160]}
          minWidth={980}
          align={["left", "left", "right", "right", "right"]}
        >
          {rows.map((r, i) => (
            <tr key={r.teamId}>
              <td>
                <span
                  className={cn(
                    "rounded-control text-ink-on-accent grid h-9 w-14 place-items-center text-lg font-bold",
                    i < 3 ? RANK[i] : "bg-rank-gray",
                  )}
                >
                  {i + 1}
                </span>
              </td>
              <td className="text-ink text-base font-semibold">{r.name}</td>
              <td className="money text-right">{formatRupiah(r.cash)}</td>
              <td className="money text-right">{formatRupiah(r.holdings)}</td>
              <td className="money text-ink text-right text-base font-bold">{formatRupiah(r.total)}</td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCorrect(r.teamId)}
                    aria-label={`Koreksi saldo ${r.name}`}
                  >
                    Koreksi saldo
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setQrTeam(r)}
                    aria-label={`Lihat QR ${r.name}`}
                  >
                    Lihat QR
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="text-ink-muted text-sm">
          Total = saldo + nilai aset menurut harga tayang saat ini. Koreksi saldo mengubah saldo bebas, wajib
          beralasan, dan tercatat di audit. Lihat QR menampilkan kartu tim untuk diunduh ulang; setiap
          pembukaan tercatat di audit.
        </p>
      </Card>

      <TeamCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onDone={() => {
          toast.success("Tim baru ditambahkan.");
          void refresh();
        }}
      />
      <CorrectionDialog
        open={correct !== null}
        onOpenChange={(o) => !o && setCorrect(null)}
        teams={teams}
        teamId={correct}
        onDone={() => {
          toast.success("Koreksi saldo tersimpan.");
          void refresh();
        }}
      />

      <TeamQrDialog
        team={qrTeam ? { id: qrTeam.teamId, name: qrTeam.name } : null}
        onOpenChange={(o) => !o && setQrTeam(null)}
      />
    </>
  );
}
