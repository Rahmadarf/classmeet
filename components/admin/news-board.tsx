"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { restartNews, setNewsReady, skipNews } from "@/app/admin/news/actions";
import { DraftEffectsToggle, NewsEffects } from "@/components/admin/news-effects";
import { NewsHistory } from "@/components/admin/news-history";
import { NewsEventDialog } from "@/components/admin/news-event-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchNewsPage, type NewsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { qk } from "@/lib/query/keys";
import { useLivePage } from "@/lib/query/use-live-page";
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
  const { data: page, refresh } = useLivePage({
    key: qk.admin("news"),
    label: "news",
    initial,
    pollMs: POLL_MS,
    fetch: async () => {
      const game = await fetchAdminGame(supabase);
      return fetchNewsPage(supabase, game ? game.startedAt !== null : initial.locked);
    },
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; newsId: string | null }>({
    open: false,
    newsId: null,
  });

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
  const [restartOpen, setRestartOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    setRestartError(null);
    const res = await restartNews().catch(() => ({
      ok: false as const,
      message: "Koneksi bermasalah. Coba lagi.",
    }));
    setRestarting(false);
    if (res.ok) {
      setRestartOpen(false);
      toast.success(`Berita dimulai ulang: ${res.data} berita kembali ke kumpulan.`);
      void refresh();
    } else setRestartError(res.message);
  };
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const liveNow = page.currentEffects?.status === "live";

  const skip = async () => {
    if (skipping) return;
    setSkipping(true);
    setSkipError(null);
    const res = await skipNews().catch(() => ({
      ok: false as const,
      message: "Koneksi bermasalah. Coba lagi.",
    }));
    setSkipping(false);
    if (res.ok) {
      setSkipOpen(false);
      toast.success("Berita dilewati: efeknya berlaku sekarang dan berita berikutnya tayang.");
      void refresh();
    } else setSkipError(res.message);
  };
  const kindLabel: Record<string, string> = {
    price: "Harga saja",
    bankrupt: "Bangkrut",
    suspend: "Suspensi",
    dividend: "Dividen",
  };
  const missing = (page.coverage ?? []).filter((c) => c.bankrupt < 1 || c.suspend < 1 || c.dividend < 1);

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
            {liveNow ? (
              <div>
                <Button variant="soft" size="sm" onClick={() => setSkipOpen(true)}>
                  Lewati berita (untuk uji)
                </Button>
              </div>
            ) : null}
            {page.currentEffects ? (
              <div className="border-line mt-2 flex flex-col gap-3 border-t pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-ink text-lg font-bold">
                    Aset yang berubah ({page.currentEffects.effects.length})
                  </h3>
                  <Chip
                    tone={page.currentEffects.status === "live" ? "neutral" : "up"}
                    className="text-sm font-semibold"
                  >
                    {page.currentEffects.status === "live" ? "Belum berlaku" : "Sudah berlaku"}
                  </Chip>
                </div>
                <NewsEffects effects={page.currentEffects.effects} events={page.currentEffects.events} />
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-ink-muted text-lg">Belum ada berita yang tayang.</p>
        )}
      </Card>

      {page.applied ? <NewsHistory items={page.applied} /> : null}

      {page.kinds ? (
        <Card aria-labelledby="jenis" className="flex flex-col gap-1.5">
          <h2 id="jenis" className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Jenis berita siap terbit
          </h2>
          <p className="tnum text-ink mt-1 text-lg font-bold">
            {page.kinds.map((k) => `${kindLabel[k.kind]} ${k.ready}`).join(" · ")}
          </p>
          <p className="text-ink-muted text-base">
            Event (bangkrut, suspensi, dividen) tidak ditentukan urutannya: sistem menghitung peluang tiap
            aset dari kondisi pasar, lalu baru memilih berita yang cocok saat berita diterbitkan.
          </p>
        </Card>
      ) : null}

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
            Harga tidak bisa diubah siapa pun sampai game selesai. Admin hanya melihat berita yang sedang
            tayang beserta aset dan persen perubahannya, bukan berita berikutnya, urutan, atau waktu
            berlakunya.
          </p>
          <div className="mt-3">
            <Button variant="danger" onClick={() => setRestartOpen(true)}>
              Mulai ulang berita
            </Button>
          </div>
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
          {page.coverage ? (
            <details className="border-line rounded-panel border px-4 py-3" open={missing.length > 0}>
              <summary className="text-ink cursor-pointer text-base font-semibold">
                Cakupan event per aset:{" "}
                {missing.length === 0 ? (
                  <span className="text-ok-text">semua aset punya bangkrut, suspensi, dan dividen</span>
                ) : (
                  <span className="text-bad-text">{missing.length} aset belum lengkap</span>
                )}
              </summary>
              <table className="mt-3 w-full text-left text-sm">
                <caption className="sr-only">Jumlah berita siap per aset dan jenis event</caption>
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="py-1 font-semibold">
                      Aset
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Bangkrut
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Suspensi
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Dividen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.coverage.map((c) => (
                    <tr key={c.symbol} className="border-line border-t">
                      <th scope="row" className="text-ink py-1 font-semibold">
                        {c.symbol}
                      </th>
                      {([c.bankrupt, c.suspend, c.dividend] as const).map((n, i) => (
                        <td
                          key={i}
                          className={`tnum py-1 text-right font-semibold ${n < 1 ? "text-bad-text" : "text-ink"}`}
                        >
                          {n < 1 ? "0 (kurang)" : n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
          {page.drafts.length === 0 ? (
            <p className="text-ink-muted text-base">
              Belum ada berita. Bangkitkan kumpulan dengan <code>npm run generate-news</code>, lalu masukkan
              dengan <code>npm run seed</code>.
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
                    <DraftEffectsToggle newsId={n.id} />
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
      <ConfirmDialog
        open={skipOpen}
        onOpenChange={(o) => {
          setSkipOpen(o);
          if (!o) setSkipError(null);
        }}
        title="Lewati berita ini?"
        description={
          <>
            Efek <strong>{page.current?.title}</strong> langsung diterapkan ke harga sekarang, tanpa menunggu
            waktunya, lalu berita berikutnya tayang. Harga tidak bisa dikembalikan. Gunakan untuk pengujian.
          </>
        }
        confirmLabel="Lewati"
        loading={skipping}
        error={skipError}
        onConfirm={() => void skip()}
      />
      <ConfirmDialog
        open={restartOpen}
        onOpenChange={(o) => {
          setRestartOpen(o);
          if (!o) setRestartError(null);
        }}
        title="Mulai ulang berita?"
        description={
          <>
            Semua berita yang sudah terbit dikembalikan ke kumpulan dan bisa muncul lagi. Berita yang sedang
            tayang dibatalkan, daftar berita di halaman tim dikosongkan, dan jeda serta masa tenang event
            dimulai dari awal. <strong>Harga dan saldo tidak kembali ke semula.</strong>
          </>
        }
        confirmLabel="Mulai ulang"
        tone="danger"
        loading={restarting}
        error={restartError}
        onConfirm={() => void restart()}
      />
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
