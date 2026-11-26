"use client";

import { Download, FileUp } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { importTeamMembers, type ImportSummary } from "@/app/admin/teams/members-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchTeamsForImport } from "@/lib/admin/data";
import { downloadText } from "@/lib/admin/download";
import {
  hasErrors,
  nameKey,
  parseMembers,
  templateCsv,
  toImportRows,
  type ParsedTeam,
  type ParseResult,
} from "@/lib/admin/members";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 1_000_000;

type TeamInfo = { id: string; name: string; members: number };
type Plan = { team: ParsedTeam; match: TeamInfo | null };

/**
 * Impor anggota tim dari dokumen berformat blok (nama tim, lalu anggotanya; lihat `lib/admin/members.ts`). Tiga langkah:
 * pilih berkas atau tempel teks → PRATINJAU per tim (tidak menyimpan apa pun; galat dan peringatan per baris, tim yang tidak
 * dikenal, dan berapa anggota lama yang akan diganti) → konfirmasi. Impor MENGGANTI seluruh anggota tiap tim yang ada di berkas;
 * tim yang tidak ada di berkas tidak berubah. Berkas diurai di peramban; database memvalidasi ulang.
 */
export function MembersImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const uid = useId();
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [teams, setTeams] = useState<TeamInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const reset = () => {
    setText("");
    setFileName(null);
    setParsed(null);
    setTeams(null);
    setBusy(false);
    setError(null);
    setConfirmed(false);
    setSummary(null);
  };

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    if (summary) onDone();
    window.setTimeout(reset, 200);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("Berkas terlalu besar (maksimal 1 MB). Bagi menjadi beberapa berkas.");
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setError("Berkas tidak bisa dibaca.");
    }
  };

  const check = async () => {
    if (busy || text.trim() === "") return;
    setBusy(true);
    setError(null);
    setConfirmed(false);
    try {
      const list = await fetchTeamsForImport(supabase);
      if (!list) {
        setError("Daftar tim belum bisa dimuat. Coba lagi.");
        return;
      }
      setTeams(list);
      setParsed(parseMembers(text));
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const plan: Plan[] = useMemo(() => {
    if (!parsed || !teams) return [];
    const byKey = new Map(teams.map((t) => [nameKey(t.name), t]));
    return parsed.teams.map((team) => ({ team, match: byKey.get(nameKey(team.name)) ?? null }));
  }, [parsed, teams]);

  const importing = plan.filter((p) => p.team.members.length > 0);
  const unknown = importing.filter((p) => p.match === null);
  const newCount = importing.reduce((n, p) => n + p.team.members.length, 0);
  const replaced = importing.reduce((n, p) => n + (p.match?.members ?? 0), 0);
  const blocked = !parsed || hasErrors(parsed) || unknown.length > 0 || importing.length === 0;
  const canImport = !blocked && (replaced === 0 || confirmed);

  const run = async () => {
    if (!parsed || !canImport || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await importTeamMembers({ rows: toImportRows(parsed) });
      if (res.ok) setSummary(res.data);
      else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="w-[min(760px,94vw)]">
        {summary ? (
          <div className="flex flex-col gap-4">
            <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
              Anggota diimpor
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              <strong className="text-ink">{summary.added}</strong> anggota disimpan di{" "}
              <strong className="text-ink">{summary.teams}</strong> tim
              {summary.removed > 0 ? (
                <>
                  ; <strong className="text-ink">{summary.removed}</strong> anggota lama diganti
                </>
              ) : null}
              .
            </DialogDescription>
            <Button onClick={close}>Selesai</Button>
          </div>
        ) : parsed ? (
          <div className="flex flex-col gap-4">
            <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
              Pratinjau impor
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              Belum ada yang disimpan. Periksa hasil di bawah, lalu konfirmasi.
            </DialogDescription>

            <p className="text-ink text-base font-semibold">
              {importing.length} tim, {newCount} anggota
              {replaced > 0 ? `; ${replaced} anggota lama akan diganti` : ""}.
            </p>

            <ul aria-label="Tim di berkas" className="flex max-h-[34dvh] flex-col gap-2 overflow-y-auto">
              {plan.map(({ team, match }) => (
                <li key={team.name} className="rounded-row border-line bg-field border px-4 py-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-base">
                      <span className="text-ink font-semibold">{team.name}</span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          team.members.length === 0
                            ? "text-ink-muted"
                            : match
                              ? "text-ink-muted"
                              : "text-bad-text",
                        )}
                      >
                        {team.members.length === 0
                          ? "tanpa anggota, dilewati"
                          : !match
                            ? "tim tidak ditemukan"
                            : `${team.members.length} anggota baru${
                                match.members > 0 ? `, menggantikan ${match.members} lama` : ""
                              }`}
                      </span>
                    </summary>
                    <ul className="text-ink-muted mt-2 flex flex-col gap-0.5 text-sm">
                      {team.members.map((m) => (
                        <li key={m.line}>
                          {m.name}
                          {m.className ? ` · ${m.className}` : ""}
                          {m.captain ? " · Ketua" : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>

            {unknown.length > 0 ? (
              <p role="alert" className="text-bad-text text-sm font-semibold">
                Tim berikut belum ada di sistem: {unknown.map((u) => u.team.name).join(", ")}. Buat tim lebih
                dulu di halaman Tim, atau perbaiki namanya di berkas.
              </p>
            ) : null}

            {parsed.issues.length > 0 ? (
              <ul
                aria-label="Catatan pada berkas"
                className="border-line rounded-row flex max-h-[22dvh] flex-col gap-1 overflow-y-auto border px-4 py-3"
              >
                {parsed.issues.map((i, k) => (
                  <li
                    key={k}
                    className={cn(
                      "text-sm",
                      i.level === "error" ? "text-bad-text font-semibold" : "text-ink-muted",
                    )}
                  >
                    {i.level === "error" ? "Galat" : "Peringatan"}, baris {i.line}: {i.message}
                  </li>
                ))}
              </ul>
            ) : null}

            {!blocked && replaced > 0 ? (
              <label className="text-ink flex items-start gap-3 text-base font-medium">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 size-5"
                />
                <span>
                  Saya mengerti: {replaced} anggota lama di tim-tim ini akan dihapus dan diganti isi berkas.
                  Tim yang tidak ada di berkas tidak berubah.
                </span>
              </label>
            ) : null}

            {error ? (
              <p role="alert" className="text-bad-text text-base font-semibold">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setParsed(null);
                  setError(null);
                  setConfirmed(false);
                }}
              >
                Kembali
              </Button>
              <Button
                loading={busy}
                loadingText="Mengimpor…"
                disabled={!canImport}
                onClick={() => void run()}
              >
                {replaced > 0 ? `Ganti dengan ${newCount} anggota` : `Impor ${newCount} anggota`}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
              Impor anggota
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              Tulis nama tim di satu baris, lalu anggotanya di bawahnya (nama, kelas, peran). Pisahkan tim
              dengan satu baris kosong. Impor mengganti seluruh anggota tim yang ada di berkas.
            </DialogDescription>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={`${uid}-file`}
                className="rounded-control border-brand-text bg-card text-brand-text hover:bg-soft inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 px-4 text-base font-semibold"
              >
                <FileUp className="size-5" aria-hidden /> Pilih berkas CSV
              </label>
              <input
                id={`${uid}-file`}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => downloadText("templat-anggota-tim.csv", templateCsv())}
              >
                <Download className="size-5" aria-hidden /> Unduh templat
              </Button>
              {fileName ? <span className="text-ink-muted text-sm">{fileName}</span> : null}
            </div>

            <label htmlFor={`${uid}-teks`} className="text-ink-muted text-base font-medium">
              Atau tempel dari spreadsheet
            </label>
            <textarea
              id={`${uid}-teks`}
              rows={10}
              spellCheck={false}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName(null);
              }}
              placeholder={
                "Tim Elang\nnama,kelas,peran\nBudi Santoso,XI IPA 1,Ketua\nSiti Aminah,XI IPA 2,Anggota\n\nTim Naga\n…"
              }
              className="rounded-control border-line bg-field text-ink focus:border-brand-text w-full border px-4 py-3 font-mono text-base"
            />

            {error ? (
              <p role="alert" className="text-bad-text text-base font-semibold">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                Batal
              </Button>
              <Button type="submit" loading={busy} loadingText="Memeriksa…" disabled={text.trim() === ""}>
                Periksa
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
