"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { setNewsReady } from "@/app/admin/news/actions";
import { NewsEventDialog } from "@/components/admin/news-event-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchNewsPage, type NewsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { usePolling } from "@/lib/hooks/use-polling";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15_000;

/**
 * Berita (Figma `Admin — Berita`, 1085:444; docs/07 §3.8). Dua wajah menurut `game_settings.started_at`:
 *  - SESUDAH game dibuka (terkunci): berita yang sedang tayang (`news_feed`, tanpa efek/waktu) dan kartu "Kumpulan
 *    berita terkunci" berisi jumlah dari `get_news_pool_status()`. Tidak ada isi, urutan, hitung mundur, atau tombol
 *    untuk memilih/meluncurkan/mempercepat (RLS menyembunyikan `news` dan `news_effects` dari admin).
 *  - SEBELUM dibuka (persiapan): daftar berita dengan jumlah aset terkena dan tombol Tandai siap / Keluarkan
 *    (`admin_set_news_ready`). Penulisan dan penandaan massal lewat `scripts/import-news.ts` (belum ada).
 */
export function NewsBoard({ initial }: { initial: NewsPage }) {
  const supabase = useMemo(() => createClient(), []);
  const [page, setPage] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; newsId: string | null }>({
    open: false,
    newsId: null,
  });

  const refresh = useCallback(async () => {
    const game = await fetchAdminGame(supabase);
    const next = await fetchNewsPage(supabase, game ? game.startedAt !== null : initial.locked);
    if (next) setPage(next);
  }, [supabase, initial.locked]);
  usePolling(refresh, POLL_MS);

  const toggle = async (id: string, ready: boolean) => {
    if (busyId) return;
    setBusyId(id);
    const res = await setNewsReady({ newsId: id, ready }).catch(() => ({
      ok: false as const,
      message: "Koneksi bermasalah. Coba lagi.",
    }));
    setBusyId(null);
    if (res.ok) toast.success(ready ? "Berita ditandai siap." : "Berita dikeluarkan dari kumpulan.");
    else toast.error(res.message);
    void refresh();
  };

  const pool = page.pool;

  return (
    <div className="flex flex-col gap-6">
      <Card aria-labelledby="saat-ini" className="flex flex-col gap-3">
        <h2 id="saat-ini" className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Berita saat ini
        </h2>
        {page.current ? (
          <>
            <p className="text-ink text-2xl font-bold">{page.current.title}</p>
            <p className="text-ink-muted text-lg leading-[1.6] whitespace-pre-line">{page.current.body}</p>
          </>
        ) : (
          <p className="text-ink-muted text-lg">Belum ada berita yang tayang.</p>
        )}
      </Card>

      {page.locked ? (
        <Card aria-labelledby="terkunci" className="flex flex-col gap-1.5">
          <h2 id="terkunci" className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Kumpulan berita terkunci
          </h2>
          {pool ? (
            <p className="tnum text-ink mt-2 text-xl font-bold">
              Siap {pool.ready} · terpakai {pool.applied} · sedang tayang {pool.live}
            </p>
          ) : (
            <p role="status" className="text-ink-muted mt-2 text-base">
              Jumlah belum bisa dimuat, mencoba lagi…
            </p>
          )}
          <p className="text-ink-muted text-base">
            Harga tidak bisa diubah siapa pun sampai game selesai. Admin tidak melihat isi maupun urutan
            berita.
          </p>
        </Card>
      ) : (
        <Card aria-labelledby="persiapan" className="flex flex-col gap-3">
          <h2
            id="persiapan"
            className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase"
          >
            Persiapan kumpulan berita
          </h2>
          {pool ? (
            <p className="tnum text-ink text-lg font-semibold">
              Draf {pool.draft} · siap {pool.ready} · boleh terbit {pool.eligible}
            </p>
          ) : null}
          {page.drafts.length === 0 ? (
            <p className="text-ink-muted text-base">
              Belum ada berita. Penulisan dan impor massal memakai <code>scripts/import-news.ts</code> (belum
              dibuat).
            </p>
          ) : (
            <ul>
              {page.drafts.map((n) => (
                <li key={n.id} className="border-line flex items-center gap-4 border-t py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-lg font-semibold">{n.title}</p>
                    <p className="text-ink-muted text-sm">
                      {n.assets} aset terkena · {n.status}
                    </p>
                    {n.bankruptcy ? (
                      <p className="text-bad-text text-sm font-semibold">
                        Bangkrut: {n.bankruptcy.symbol} ({n.bankruptcy.name}) · unit diganti{" "}
                        {n.bankruptcy.pct} % harga acuan
                      </p>
                    ) : null}
                    {n.events.map((e) => (
                      <p key={`${e.kind}-${e.assetId}`} className="text-ink text-sm font-semibold">
                        {e.kind === "dividend"
                          ? `Dividen: ${e.symbol} (${e.name}) · ${e.amount} % harga acuan per unit`
                          : `Suspensi: ${e.symbol} (${e.name}) · ${e.amount} menit`}
                      </p>
                    ))}
                  </div>
                  <Button
                    variant="soft"
                    size="sm"
                    disabled={busyId !== null || n.status !== "draft"}
                    title={n.status === "ready" ? "Keluarkan berita dari kumpulan dulu" : undefined}
                    onClick={() => setBankDialog({ open: true, newsId: n.id })}
                  >
                    Event aset
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId !== null || (n.status !== "draft" && n.status !== "ready")}
                    onClick={() => void toggle(n.id, n.status !== "ready")}
                  >
                    {n.status === "ready" ? "Keluarkan" : "Tandai siap"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <NewsEventDialog
        open={bankDialog.open}
        onOpenChange={(o) => setBankDialog((d) => ({ ...d, open: o }))}
        news={page.drafts.find((n) => n.id === bankDialog.newsId) ?? null}
        assets={page.assets}
        onDone={(message, other) => {
          toast.success(message);
          if (other > 0)
            toast.warning(
              `${other} berita lain masih punya efek harga pada aset itu dan akan gagal terbit. Keluarkan aset itu dari efeknya.`,
            );
          void refresh();
        }}
      />
    </div>
  );
}
