"use client";

import { useMemo, useState } from "react";
import { DoorClosed, DoorOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePost, setPostOpen } from "@/app/admin/posts/actions";
import { PostCreateDialog } from "@/components/admin/post-create-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/chip";
import { fetchPostsPage, type AdminPost } from "@/lib/admin/data";
import { canDeleteInState, deleteBlockedReason } from "@/lib/admin/delete-guard";
import { fetchAdminGame, type AdminGame } from "@/lib/admin/state";
import type { ActionResult } from "@/lib/schemas/common";
import { formatRupiah } from "@/lib/money";
import { qk } from "@/lib/query/keys";
import { useLivePage } from "@/lib/query/use-live-page";
import { useRealtime } from "@/lib/query/use-realtime";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15_000;
const GAME_POLL_MS = 5_000;

/**
 * Pos (Figma `Admin — Pos`, 1105:379): nomor, game, lokasi, penjaga, total hadiah, status. Chip ringkasan "N Tersedia /
 * N Tidak tersedia". Admin bisa mengubah ketersediaan pos (Tersedia / Tidak tersedia) lewat `admin_set_post_open` (docs/04 §3.9), dinonaktifkan saat game
 * selesai. Hapus pos (beserta akun penjaganya; konfirmasi) HANYA saat status game Setup: status dibaca langsung (kunci
 * `admin/game`), tombol diblokir dengan alasan selain Setup, dan database menegakkan aturan yang sama (`admin_delete_post`).
 * Berubah lewat Realtime `posts`.
 */
export function PostsBoard({ initial, initialGame }: { initial: AdminPost[]; initialGame: AdminGame }) {
  const supabase = useMemo(() => createClient(), []);
  const { data: posts, refresh } = useLivePage({
    key: qk.admin("posts"),
    label: "posts",
    initial,
    pollMs: POLL_MS,
    fetch: () => fetchPostsPage(supabase),
  });
  const { data: game, refresh: refreshGame } = useLivePage({
    key: qk.admin("game"),
    label: "game",
    initial: initialGame,
    pollMs: GAME_POLL_MS,
    fetch: () => fetchAdminGame(supabase),
  });
  const finished = game.state === "finished";
  const canDelete = canDeleteInState(game.state);
  const blockedReason = deleteBlockedReason(game.state, "pos");
  const [deleting, setDeleting] = useState<{ id: string; title: string; guard: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "rally" | "lomba">("all");

  useRealtime("admin-posts", [
    { event: "*", table: "posts", onEvent: () => void refresh() },
    { event: "INSERT", table: "payouts", onEvent: () => void refresh() },
    { event: "UPDATE", table: "game_settings", onEvent: () => void refreshGame() },
  ]);

  const runDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await deletePost({ postId: deleting.id }).catch((): ActionResult => ({
      ok: false,
      message: "Koneksi bermasalah. Coba lagi.",
      code: null,
      retryable: true,
    }));
    setDeleteBusy(false);
    if (res.ok) {
      toast.success(`${deleting.title} dihapus.`);
      setDeleting(null);
    } else {
      setDeleteError(res.message);
    }
    void Promise.all([refresh(), refreshGame()]);
  };

  const toggle = async (p: AdminPost) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const res = await setPostOpen({ postId: p.id, open: !p.open });
      if (res.ok) toast.success(`${p.title} sekarang ${p.open ? "tidak tersedia" : "tersedia"}.`);
      else toast.error(res.message);
      void refresh();
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusyId(null);
    }
  };

  // Ringkasan Tersedia/Tidak tersedia hanya untuk pos rally; lomba tidak punya status buka/tutup.
  const rally = posts.filter((p) => p.kind === "rally");
  const open = rally.filter((p) => p.open).length;
  const shown = filter === "all" ? posts : posts.filter((p) => p.kind === filter);

  return (
    <>
      <PageHeader
        eyebrow="Stasiun aktivitas"
        title="Pos"
        subtitle="Penjaga atau PIC, total hadiah, dan status tiap pos dan lomba."
        actions={
          <>
            <StatusPill tone="ok">{open} Tersedia</StatusPill>
            <StatusPill tone="bad">{rally.length - open} Tidak tersedia</StatusPill>
            <IconButton
              icon={Plus}
              size="icon"
              label="Tambah pos atau lomba"
              onClick={() => setCreating(true)}
            />
          </>
        }
      />
      <Card aria-labelledby="pos-judul" className="flex flex-col gap-2">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Ketersediaan saat ini
        </p>
        <h2 id="pos-judul" className="text-ink text-2xl font-bold">
          {rally.length} pos, {posts.length - rally.length} lomba
        </h2>
        <div role="group" aria-label="Filter jenis" className="flex gap-2">
          {(
            [
              ["all", "Semua"],
              ["rally", "Pos rally"],
              ["lomba", "Lomba"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={
                filter === k
                  ? "bg-nav-active text-brand-text min-h-10 rounded-full px-4 text-base font-semibold"
                  : "text-ink-muted hover:bg-tint min-h-10 rounded-full px-4 text-base font-medium"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <DataTable
          caption="Daftar pos"
          head={["No", "Game", "Lokasi", "Penjaga / PIC", "Total hadiah", "Status", ""]}
          widths={[64, 170, 170, 150, 150, 160, 140]}
          minWidth={960}
        >
          {shown.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="rounded-control bg-tint text-ink grid h-9 w-11 place-items-center text-base font-bold">
                  {p.number ?? "–"}
                </span>
              </td>
              <td className="text-ink text-base font-semibold">
                {p.title}
                {p.kind === "lomba" ? (
                  <span className="text-brand-text ml-2 text-xs font-semibold tracking-[0.1em] uppercase">
                    Lomba
                  </span>
                ) : null}
              </td>
              <td>{p.location}</td>
              <td>{p.guard}</td>
              <td className="money text-ink text-right font-bold">{formatRupiah(p.total)}</td>
              <td>
                {p.kind === "lomba" ? (
                  <span className="text-ink-muted text-base">–</span>
                ) : (
                  <StatusPill tone={p.open ? "ok" : "bad"}>
                    {p.open ? "Tersedia" : "Tidak tersedia"}
                  </StatusPill>
                )}
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  {p.kind === "lomba" ? null : (
                    <IconButton
                      variant={p.open ? "danger" : "secondary"}
                      icon={p.open ? DoorClosed : DoorOpen}
                      label={`${p.open ? "Jadikan tidak tersedia" : "Jadikan tersedia"}: ${p.title}`}
                      tooltip={
                        finished
                          ? "Game selesai: status pos tidak bisa diubah"
                          : p.open
                            ? "Jadikan tidak tersedia"
                            : "Jadikan tersedia"
                      }
                      disabled={finished || busyId !== null}
                      loading={busyId === p.id}
                      onClick={() => void toggle(p)}
                    />
                  )}
                  <IconButton
                    variant="danger"
                    icon={Trash2}
                    label={`Hapus ${p.title}`}
                    tooltip={blockedReason ?? "Hapus pos"}
                    disabled={!canDelete}
                    aria-describedby={canDelete ? undefined : "hapus-pos-alasan"}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting({ id: p.id, title: p.title, guard: p.guard });
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="text-ink-muted text-sm">
          Pos baru selalu mulai Tidak tersedia. Tersedia = pos masih kurang tim atau belum ada tim untuk
          memulai permainan; Tidak tersedia = pos penuh atau permainan sedang dimulai. Penjaga dan admin bisa
          mengubahnya. Lomba (dijaga PIC lomba) tidak punya status buka/tutup.
          {finished ? " Game selesai: status pos tidak bisa diubah." : ""} Total hadiah mengikuti halaman
          Hadiah. Hapus menghilangkan pos beserta akun penjaganya; hanya bisa saat status game Setup dan untuk
          pos yang belum pernah memberi hadiah (Reset game mengosongkan hadiah).
        </p>
        {blockedReason ? (
          <p id="hapus-pos-alasan" className="text-bad-text text-sm font-medium">
            {blockedReason}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title={`Hapus ${deleting?.title ?? "pos"}?`}
        description={
          <>
            <strong className="text-ink">{deleting?.title}</strong> akan dihapus beserta akunnya (
            {deleting?.guard}). Akun itu tidak bisa masuk lagi. Ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus pos"
        tone="danger"
        loading={deleteBusy}
        error={deleteError}
        confirmDisabled={!canDelete}
        onConfirm={() => void runDelete()}
      />
      <PostCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onDone={() => {
          toast.success("Pos baru ditambahkan.");
          void refresh();
        }}
      />
    </>
  );
}
