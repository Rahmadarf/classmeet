"use client";

import { useMemo, useState } from "react";
import { HandCoins, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTeam } from "@/app/admin/teams/actions";
import { CorrectionDialog } from "@/components/admin/correction-dialog";
import { TeamCreateDialog } from "@/components/admin/team-create-dialog";
import { TeamQrDialog } from "@/components/admin/team-qr-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { fetchTeamsPage, type TeamRow } from "@/lib/admin/data";
import { canDeleteInState, deleteBlockedReason } from "@/lib/admin/delete-guard";
import { fetchAdminGame, type AdminGame } from "@/lib/admin/state";
import type { ActionResult } from "@/lib/schemas/common";
import { formatRupiah } from "@/lib/money";
import { qk } from "@/lib/query/keys";
import { useLivePage } from "@/lib/query/use-live-page";
import { useRealtime } from "@/lib/query/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;
const GAME_POLL_MS = 5_000;

/** Warna lencana menurut posisi: 1 emas, 2 biru muda, 3 oranye, 4+ abu-abu (docs/07 §2.3). */
const RANK = ["bg-accent-2", "bg-brand-light", "bg-accent"] as const;

/**
 * Tim (Figma `Admin — Tim`, 1104:660): peringkat langsung semua tim (`get_leaderboard()` untuk admin selalu data
 * langsung, bukan snapshot), saldo, nilai aset (harga peringkat), total; Koreksi saldo (dialog) dan Lihat QR (dialog
 * kartu QR + unduh PNG, tampilan sama dengan dialog "Tambah tim"; menggantikan tombol "Ganti QR" lama), dan Hapus
 * (konfirmasi; HANYA saat status game Setup. Status dibaca langsung (kunci `admin/game`, sama dengan halaman Status Game);
 * selain Setup tombol diblokir dengan alasan. Database menegakkan aturan yang sama: `admin_delete_team`).
 */
export function TeamsBoard({ initial, initialGame }: { initial: TeamRow[]; initialGame: AdminGame }) {
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
  const { data: game, refresh: refreshGame } = useLivePage({
    key: qk.admin("game"),
    label: "game",
    initial: initialGame,
    pollMs: GAME_POLL_MS,
    fetch: () => fetchAdminGame(supabase),
  });
  useRealtime("admin-teams-game", [
    { event: "UPDATE", table: "game_settings", onEvent: () => void refreshGame() },
  ]);
  const canDelete = canDeleteInState(game.state);
  const blockedReason = deleteBlockedReason(game.state, "tim");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [correct, setCorrect] = useState<string | null>(null);
  const [qrTeam, setQrTeam] = useState<TeamRow | null>(null);
  const [creating, setCreating] = useState(false);

  const runDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await deleteTeam({ teamId: deleting.id }).catch((): ActionResult => ({
      ok: false,
      message: "Koneksi bermasalah. Coba lagi.",
      code: null,
      retryable: true,
    }));
    setDeleteBusy(false);
    if (res.ok) {
      toast.success(`${deleting.name} dihapus.`);
      setDeleting(null);
    } else {
      setDeleteError(res.message);
    }
    void Promise.all([refresh(), refreshGame()]);
  };

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
          <IconButton icon={Plus} size="icon" label="Tambah tim" onClick={() => setCreating(true)} />
        </div>
        <DataTable
          caption="Peringkat langsung semua tim"
          head={["#", "Tim", "Saldo", "Nilai aset (harga tayang)", "Total", ""]}
          widths={[72, 220, 150, 230, 160]}
          minWidth={900}
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
                  <IconButton
                    variant="secondary"
                    icon={HandCoins}
                    label={`Koreksi saldo ${r.name}`}
                    tooltip="Koreksi saldo"
                    onClick={() => setCorrect(r.teamId)}
                  />
                  <IconButton
                    variant="secondary"
                    icon={QrCode}
                    label={`Lihat QR ${r.name}`}
                    tooltip="Lihat QR"
                    onClick={() => setQrTeam(r)}
                  />
                  <IconButton
                    variant="danger"
                    icon={Trash2}
                    label={`Hapus ${r.name}`}
                    tooltip={blockedReason ?? "Hapus tim"}
                    disabled={!canDelete}
                    aria-describedby={canDelete ? undefined : "hapus-tim-alasan"}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting({ id: r.teamId, name: r.name });
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="text-ink-muted text-sm">
          Total = saldo + nilai aset menurut harga tayang saat ini. Koreksi saldo mengubah saldo bebas, wajib
          beralasan, dan tercatat di audit. Lihat QR menampilkan kartu tim untuk diunduh ulang; setiap
          pembukaan tercatat di audit. Hapus menghilangkan tim beserta akun login dan kartu QR-nya; hanya bisa
          saat status game Setup dan untuk tim tanpa saldo atau riwayat (Reset game mengosongkannya).
        </p>
        {blockedReason ? (
          <p id="hapus-tim-alasan" className="text-bad-text text-sm font-medium">
            {blockedReason}
          </p>
        ) : null}
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title={`Hapus ${deleting?.name ?? "tim"}?`}
        description={
          <>
            Tim <strong className="text-ink">{deleting?.name}</strong> akan dihapus beserta akun login dan
            kartu QR-nya. Kartu yang sudah dicetak tidak berlaku lagi. Ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus tim"
        tone="danger"
        loading={deleteBusy}
        error={deleteError}
        confirmDisabled={!canDelete}
        onConfirm={() => void runDelete()}
      />

      <TeamQrDialog
        team={qrTeam ? { id: qrTeam.teamId, name: qrTeam.name } : null}
        onOpenChange={(o) => !o && setQrTeam(null)}
      />
    </>
  );
}
