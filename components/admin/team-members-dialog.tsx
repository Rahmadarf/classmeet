"use client";

import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteTeamMember, saveTeamMember } from "@/app/admin/teams/members-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { fetchTeamMembers, type TeamMember } from "@/lib/admin/data";
import { downloadText, fileSlug } from "@/lib/admin/download";
import { teamBlockCsv } from "@/lib/admin/members";
import { createClient } from "@/lib/supabase/client";

const field =
  "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text disabled:opacity-60";

type Draft = { id: number | null; name: string; className: string; captain: boolean };
const EMPTY: Draft = { id: null, name: "", className: "", captain: false };

/**
 * Anggota satu tim: daftar (ketua di atas), tambah, ubah, hapus (dua langkah), dan unduh CSV tim itu dalam format impor.
 * Data pribadi: dibaca lewat RLS (hanya admin) dan ditulis lewat fungsi admin; tidak dicatat di audit selain jumlah dan id.
 */
export function TeamMembersDialog({
  team,
  onOpenChange,
  onChanged,
}: {
  team: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil sesudah tambah/ubah/hapus supaya kolom jumlah anggota di tabel dimuat ulang. */
  onChanged: () => void;
}) {
  const uid = useId();
  const supabase = useMemo(() => createClient(), []);
  const teamId = team?.id ?? null;
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!teamId) return;
    const list = await fetchTeamMembers(supabase, teamId).catch(() => null);
    setLoadError(list === null);
    if (list) setMembers(list);
  }, [supabase, teamId]);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    fetchTeamMembers(supabase, teamId)
      .catch(() => null)
      .then((list) => {
        if (cancelled) return;
        setLoadError(list === null);
        if (list) setMembers(list);
      });
    return () => {
      cancelled = true;
      setMembers(null);
      setLoadError(false);
      setDraft(null);
      setError(null);
      setConfirmId(null);
    };
  }, [supabase, teamId]);

  if (!team) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const submit = async () => {
    if (!draft || busy || draft.name.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveTeamMember({
        memberId: draft.id,
        teamId: team.id,
        name: draft.name,
        className: draft.className.trim() === "" ? null : draft.className,
        captain: draft.captain,
      });
      if (res.ok) {
        toast.success(draft.id === null ? "Anggota ditambahkan." : "Anggota diperbarui.");
        setDraft(null);
        await reload();
        onChanged();
      } else {
        setError(res.message);
      }
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteTeamMember({ memberId: id });
      if (res.ok) {
        toast.success("Anggota dihapus.");
        setConfirmId(null);
        await reload();
        onChanged();
      } else {
        setError(res.message);
      }
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(640px,94vw)]">
        <div className="flex flex-col gap-4">
          <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
            Anggota {team.name}
          </DialogTitle>
          <DialogDescription className="text-ink-muted text-base">
            Daftar peserta tim ini. Hanya admin yang melihatnya. Untuk mengisi banyak tim sekaligus, pakai
            Impor anggota di halaman Tim.
          </DialogDescription>

          {loadError ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              Anggota belum bisa dimuat. Tutup dan buka lagi dialog ini.
            </p>
          ) : members === null ? (
            <p role="status" className="text-ink-muted py-8 text-center text-base">
              Memuat anggota…
            </p>
          ) : members.length === 0 ? (
            <p className="text-ink-muted rounded-row bg-field px-4 py-6 text-center text-base">
              Belum ada anggota.
            </p>
          ) : (
            <ul
              aria-label={`Anggota ${team.name}`}
              className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto"
            >
              {members.map((m) => (
                <li
                  key={m.id}
                  className="rounded-row border-line bg-field flex items-center justify-between gap-3 border px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate text-base font-semibold">
                      {m.name}
                      {m.captain ? (
                        <span className="bg-accent/20 text-accent-text ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                          Ketua
                        </span>
                      ) : null}
                    </p>
                    <p className="text-ink-muted truncate text-sm">{m.className ?? "Kelas belum diisi"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <IconButton
                      variant="secondary"
                      icon={Pencil}
                      label={`Ubah ${m.name}`}
                      tooltip="Ubah"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setConfirmId(null);
                        setDraft({
                          id: m.id,
                          name: m.name,
                          className: m.className ?? "",
                          captain: m.captain,
                        });
                      }}
                    />
                    {confirmId === m.id ? (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={busy}
                        loadingText="Menghapus…"
                        onClick={() => void remove(m.id)}
                      >
                        Hapus?
                      </Button>
                    ) : (
                      <IconButton
                        variant="danger"
                        icon={Trash2}
                        label={`Hapus ${m.name}`}
                        tooltip="Hapus"
                        disabled={busy}
                        onClick={() => {
                          setError(null);
                          setConfirmId(m.id);
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {draft ? (
            <form
              className="rounded-row border-line flex flex-col gap-3 border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <p className="text-ink text-lg font-semibold">
                {draft.id === null ? "Tambah anggota" : "Ubah anggota"}
              </p>
              <label htmlFor={`${uid}-nama`} className="text-ink-muted text-base font-medium">
                Nama
              </label>
              <input
                id={`${uid}-nama`}
                autoFocus
                autoComplete="off"
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={field}
              />
              <label htmlFor={`${uid}-kelas`} className="text-ink-muted text-base font-medium">
                Kelas (boleh kosong)
              </label>
              <input
                id={`${uid}-kelas`}
                autoComplete="off"
                maxLength={40}
                value={draft.className}
                onChange={(e) => setDraft({ ...draft, className: e.target.value })}
                placeholder="mis. XI IPA 1"
                className={field}
              />
              <label className="text-ink flex min-h-11 items-center gap-3 text-base font-medium">
                <input
                  type="checkbox"
                  checked={draft.captain}
                  onChange={(e) => setDraft({ ...draft, captain: e.target.checked })}
                  className="size-5"
                />
                Ketua tim
              </label>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  loading={busy}
                  loadingText="Menyimpan…"
                  disabled={draft.name.trim() === ""}
                >
                  Simpan
                </Button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              variant="secondary"
              disabled={!members || members.length === 0}
              onClick={() =>
                downloadText(
                  `anggota-${fileSlug(team.name)}.csv`,
                  "﻿" + teamBlockCsv(team.name, members ?? []) + "\n",
                )
              }
            >
              <Download className="size-5" aria-hidden /> Unduh CSV
            </Button>
            <div className="flex gap-3">
              {draft ? null : (
                <Button
                  variant="soft"
                  disabled={members === null}
                  onClick={() => {
                    setError(null);
                    setConfirmId(null);
                    setDraft(EMPTY);
                  }}
                >
                  <Plus className="size-5" aria-hidden /> Tambah anggota
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Selesai</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
