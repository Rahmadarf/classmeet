"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { resetGame, setGameState, setLeaderboardFrozen, setLeaderboardVisible } from "@/app/admin/state/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  fetchAdminGame,
  fetchNewsPool,
  gameDay,
  poolWarning,
  type AdminGame,
  type GameState,
  type NewsPool,
} from "@/lib/admin/state";
import { usePolling } from "@/lib/hooks/use-polling";
import type { ActionResult } from "@/lib/schemas/common";
import { formatTimeWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const GAME_POLL_MS = 5_000;
const POOL_POLL_MS = 10_000;

const STATE_BADGE: Record<GameState, { label: string; box: string; dot: string }> = {
  open: { label: "OPEN", box: "border-ok-text bg-ok/18 text-ok-text", dot: "bg-ok-text" },
  paused: { label: "PAUSED", box: "border-accent-text bg-accent/15 text-accent-text", dot: "bg-accent" },
  setup: { label: "SETUP", box: "border-brand-text bg-tint text-brand-text", dot: "bg-brand-text" },
  finished: { label: "FINISHED", box: "border-line-strong bg-soft text-ink-muted", dot: "bg-ink-dim" },
};

type Pending = "open-first" | "resume" | "pause" | "finish" | "reset" | null;

/** Kata yang harus diketik untuk mengonfirmasi reset game. */
const RESET_WORD = "RESET";

/**
 * Status Game (Figma `Admin — Status game`, 1085:324; docs/07 §3.7): pusat kendali harian. Hanya memuat yang harus
 * ditekan atau dipantau: status + tombol buka/tutup/akhiri (dengan konfirmasi), jumlah kumpulan berita (HANYA
 * angka; tanpa isi, urutan, atau hitung mundur), dan kontrol leaderboard. Tidak ada tombol untuk menjalankan,
 * mempercepat, atau menunda siklus berita: itu milik sistem.
 * Status: polling 5 dtk + Realtime `game_settings` (pemberitahuan); jumlah berita polling 10 dtk.
 */
export function StateBoard({ initial }: { initial: { game: AdminGame; pool: NewsPool | null } }) {
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState(initial.game);
  const [pool, setPool] = useState(initial.pool);
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [lbBusy, setLbBusy] = useState(false);
  const [resetText, setResetText] = useState("");
  const dropped = useRef(false);

  const refreshGame = useCallback(async () => {
    const next = await fetchAdminGame(supabase);
    if (next) setGame(next);
  }, [supabase]);
  const refreshPool = useCallback(async () => {
    const next = await fetchNewsPool(supabase);
    if (next) setPool(next);
  }, [supabase]);
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshGame(), refreshPool()]);
  }, [refreshGame, refreshPool]);

  usePolling(refreshGame, GAME_POLL_MS);
  usePolling(refreshPool, POOL_POLL_MS);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_settings" },
        () => void refreshAll(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refreshAll();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshAll]);

  const badge = STATE_BADGE[game.state];
  const day = now === null ? null : gameDay(game.startedAt, now);
  const warning = pool ? poolWarning(game.state, pool) : null;
  const canOpen = game.state === "setup" || game.state === "paused";

  const runState = async (state: "open" | "paused" | "finished", okText: string) => {
    setBusy(true);
    setDialogError(null);
    const res = await setGameState({ state }).catch((): ActionResult => ({
      ok: false,
      message: "Koneksi bermasalah. Coba lagi.",
      code: null,
      retryable: true,
    }));
    setBusy(false);
    if (res.ok) {
      setPending(null);
      toast.success(okText);
      void refreshAll();
    } else {
      setDialogError(res.message);
      void refreshAll();
    }
  };

  const runReset = async () => {
    setBusy(true);
    setDialogError(null);
    const res = await resetGame().catch((): ActionResult => ({
      ok: false,
      message: "Koneksi bermasalah. Coba lagi.",
      code: null,
      retryable: true,
    }));
    setBusy(false);
    if (res.ok) {
      setPending(null);
      toast.success("Game di-reset. Status kembali ke setup.");
    } else setDialogError(res.message);
    void refreshAll();
  };

  const toggleVisible = async () => {
    if (lbBusy) return;
    setLbBusy(true);
    const res = await setLeaderboardVisible({ visible: !game.leaderboardVisible }).catch(
      (): ActionResult => ({
        ok: false,
        message: "Koneksi bermasalah. Coba lagi.",
        code: null,
        retryable: true,
      }),
    );
    setLbBusy(false);
    if (!res.ok) toast.error(res.message);
    void refreshGame();
  };

  const toggleFrozen = async () => {
    if (lbBusy) return;
    setLbBusy(true);
    const res = await setLeaderboardFrozen({ frozen: game.frozenAt === null }).catch((): ActionResult => ({
      ok: false,
      message: "Koneksi bermasalah. Coba lagi.",
      code: null,
      retryable: true,
    }));
    setLbBusy(false);
    if (res.ok) toast.success(game.frozenAt === null ? "Leaderboard dibekukan." : "Pembekuan dilepas.");
    else toast.error(res.message);
    void refreshGame();
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card aria-labelledby="status-judul" className="flex flex-col gap-4">
          <h2
            id="status-judul"
            className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase"
          >
            Status game
          </h2>
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border py-2 pr-[18px] pl-3.5 text-lg font-bold",
                badge.box,
              )}
            >
              <span aria-hidden className={cn("size-2.5 rounded-full", badge.dot)} />
              {badge.label}
            </span>
            <p className="tnum text-ink text-[22px] font-bold">
              {game.state === "setup"
                ? "Belum dimulai"
                : game.state === "finished"
                  ? "Game selesai"
                  : `Hari ${day ?? "–"}${now ? ` · ${formatTimeWib(now)}` : ""}`}
            </p>
          </div>

          {game.state === "finished" ? (
            <p className="text-ink-muted text-base">
              Game sudah selesai: peringkat akhir dibekukan dan tidak ada transaksi. Tidak ada tombol yang
              tersisa.
            </p>
          ) : (
            <>
              <div className="flex gap-3">
                {canOpen ? (
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      if (game.state === "setup") setPending("open-first");
                      else void runState("open", "Pasar dibuka kembali.");
                    }}
                    loading={busy && pending === null}
                  >
                    Buka pasar
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1" onClick={() => setPending("pause")}>
                    Tutup pasar
                  </Button>
                )}
                <Button variant="danger" size="lg" className="flex-1" onClick={() => setPending("finish")}>
                  Akhiri game
                </Button>
              </div>
              <p className="text-ink-muted text-base">
                Buka pasar muncul bila status paused atau setup. Pasar dibuka 08.00 dan ditutup 19.00 secara
                manual; jangan lupa menutup.
              </p>
            </>
          )}
        </Card>

        <Card aria-labelledby="lb-judul" className="flex flex-col gap-4">
          <h2 id="lb-judul" className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Leaderboard
          </h2>
          <div className="flex items-center justify-between gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={game.leaderboardVisible}
                onChange={() => void toggleVisible()}
                disabled={lbBusy}
              />
              <span
                aria-hidden
                className={cn(
                  "rounded-control grid size-7 shrink-0 place-items-center border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--blue-text)]",
                  game.leaderboardVisible
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line-strong bg-card",
                )}
              >
                {game.leaderboardVisible ? <Check className="size-[18px]" /> : null}
              </span>
              <span className="text-ink text-lg font-medium">Tampilkan di layar publik</span>
            </label>
            <Button variant="secondary" size="lg" onClick={() => void toggleFrozen()} disabled={lbBusy}>
              {game.frozenAt === null ? "Bekukan sekarang" : "Lepas pembekuan"}
            </Button>
          </div>
          {game.frozenAt !== null ? (
            <p role="status" className="text-ink-muted text-base">
              Dibekukan sejak {formatTimeWib(game.frozenAt)} WIB. Layar publik menampilkan peringkat saat itu,
              tanpa penanda apa pun.
            </p>
          ) : null}
          {!game.leaderboardVisible ? (
            <p className="text-ink-muted text-base">
              Layar publik menampilkan layar tunggu, bukan peringkat.
            </p>
          ) : null}
        </Card>

        <Card aria-labelledby="reset-judul" className="border-bad-text/50 flex flex-col gap-4">
          <h2 id="reset-judul" className="text-bad-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Reset game
          </h2>
          <p className="text-ink-muted text-base">
            Mulai ulang dari nol: semua saldo jadi Rp 0, transaksi, kepemilikan, hadiah pos, riwayat harga, dan
            grafik IKC dihapus; harga dan stok aset kembali ke awal; berita kembali ke kumpulan. Tim, pos, aset,
            dan isi berita tetap. Status kembali ke setup.
          </p>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              setResetText("");
              setDialogError(null);
              setPending("reset");
            }}
          >
            Reset game
          </Button>
        </Card>
      </div>

      <Card aria-labelledby="berita-judul" className="flex flex-col gap-4">
        <h2
          id="berita-judul"
          className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase"
        >
          Kumpulan berita
        </h2>
        {pool ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Count label="Siap" value={pool.ready} />
              <Count label="Boleh terbit" value={pool.eligible} />
              <Count label="Terpakai" value={pool.applied} />
            </div>
            {pool.live > 0 ? (
              <p className="text-ink-muted text-base">Sedang tayang: {pool.live} berita.</p>
            ) : null}
            {warning ? (
              <p
                role={warning.level === "bad" ? "alert" : "status"}
                className={cn(
                  "rounded-panel flex items-center gap-3 border px-4 py-3.5 text-base font-semibold",
                  warning.level === "bad"
                    ? "border-bad-text bg-bad/14 text-bad-text"
                    : "border-accent-2 bg-accent-2/15 text-ink",
                )}
              >
                <AlertTriangle className="size-6 shrink-0" aria-hidden />
                {warning.text}
              </p>
            ) : null}
          </>
        ) : (
          <p role="status" className="text-ink-muted text-base">
            Jumlah berita belum bisa dimuat, mencoba lagi…
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={pending === "open-first"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Buka pasar untuk pertama kali?"
        description="Setelah dibuka, harga aset, kumpulan berita, dan pengaturan berita terkunci dan tidak bisa diubah siapa pun sampai game selesai."
        confirmLabel="Buka pasar"
        loading={busy}
        error={dialogError}
        onConfirm={() => void runState("open", "Pasar dibuka.")}
      />
      <ConfirmDialog
        open={pending === "pause"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Tutup pasar sekarang?"
        description="Tim tidak bisa membeli atau menjual sampai pasar dibuka lagi, dan siklus berita ikut berhenti."
        confirmLabel="Tutup pasar"
        loading={busy}
        error={dialogError}
        onConfirm={() => void runState("paused", "Pasar ditutup.")}
      />
      <ConfirmDialog
        open={pending === "reset"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Reset game dari awal?"
        description="Semua saldo tim jadi Rp 0, dan transaksi, kepemilikan, hadiah pos, dividen, riwayat harga, grafik IKC, serta daftar berita dihapus. Harga dan stok aset kembali ke awal. Ini tidak bisa dibatalkan."
        confirmLabel="Reset game"
        tone="danger"
        loading={busy}
        error={dialogError}
        confirmDisabled={resetText.trim().toUpperCase() !== RESET_WORD}
        onConfirm={() => void runReset()}
      >
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-ink text-base font-semibold">
            Ketik <span className="tnum">{RESET_WORD}</span> untuk melanjutkan
          </span>
          <input
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className="rounded-control border-line-strong bg-card text-ink focus-visible:outline-primary min-h-11 border-2 px-3 text-lg focus-visible:outline-2"
          />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === "finish"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Akhiri game?"
        description="Peringkat akhir dibekukan. Ini tidak bisa dibatalkan, dan pasar tidak bisa dibuka lagi."
        confirmLabel="Akhiri game"
        tone="danger"
        loading={busy}
        error={dialogError}
        onConfirm={() => void runState("finished", "Game diakhiri.")}
      />
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-soft rounded-row flex min-w-0 flex-col gap-1 p-4">
      <p className="text-ink-muted text-sm font-medium tracking-[0.08em] uppercase">{label}</p>
      <p className="tnum text-ink text-[36px] leading-tight font-bold">{value}</p>
    </div>
  );
}
