"use client";

import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";
import { AlertCircle, CameraOff } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveTeam } from "@/app/guard/actions";
import { PayoutNotices } from "@/components/guard/payout-notices";
import { PayoutSheet, type PayoutPhase, type SheetTeam } from "@/components/guard/payout-sheet";
import { PostToggle } from "@/components/guard/post-toggle";
import { fetchMyPost, splitPostName, type MyPost } from "@/lib/guard/data";
import { usePayoutQueue } from "@/lib/guard/use-payout-queue";
import { usePolling } from "@/lib/hooks/use-polling";
import { fetchGame, type GameState } from "@/lib/market/data";
import { isNetworkError } from "@/lib/errors";
import { parseTeamQr } from "@/lib/qr";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Pindai Hadiah (Figma `Penjaga — Siap pindai`, 1084:412; docs/07 §3.4). Satu halaman dengan dua keadaan: siap pindai
 * (kamera + saklar pos) dan form nominal sebagai lembar dari bawah setelah QR terbaca.
 *
 * KEAMANAN: isi QR adalah kredensial tim. Hanya bagian rahasia (`token`) yang dikirim ke `resolve_team_qr`, hidup sebagai
 * variabel lokal di `handle()`, dan tidak masuk state, log, URL, atau antrean (antrean hanya berisi id tim, nama, nominal).
 */

const POLL_MS = 15_000;
const COOLDOWN_MS = 1_500;
const MESSAGE_MS = 5_000;

const MSG_UNKNOWN = "Kartu tidak dikenali. Coba lagi atau minta bantuan panitia.";
const MSG_NETWORK = "Koneksi bermasalah. Coba lagi sebentar lagi.";
const MSG_CAMERA = "Kamera tidak bisa dipakai. Izinkan kamera untuk halaman ini, atau hubungi panitia.";

// Pembaca QR (zxing WASM) disajikan dari /vendor (disalin `npm run dev/build`), bukan dari CDN.
const Scanner = dynamic(
  async () => {
    const mod = await import("@yudiel/react-qr-scanner");
    mod.setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path,
    });
    return mod.Scanner;
  },
  { ssr: false },
);

// SEMENTARA (dev saja): menguji tanpa kamera lewat seret/tempel gambar QR. Lihat dev-qr-drop.tsx untuk cara menghapus.
const DevQrDrop =
  process.env.NODE_ENV !== "production"
    ? dynamic(() => import("@/components/kiosk/dev-qr-drop").then((m) => m.DevQrDrop), { ssr: false })
    : null;

const BANNER: Partial<Record<GameState, string>> = {
  setup: "Game belum dimulai. Hadiah belum bisa dikirim.",
  finished: "Game sudah selesai. Hadiah dan saklar pos tidak bisa dipakai lagi.",
};

export function ScanBoard({
  guardId,
  initialPost,
  initialState,
}: {
  guardId: string;
  initialPost: MyPost;
  initialState: GameState;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState(initialPost);
  const [state, setState] = useState(initialState);
  const [team, setTeam] = useState<SheetTeam | null>(null);
  // Nominal yang baru dikirim dari form terbuka: form beralih ke tampilan saldo naik, lalu menutup sendiri.
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<IScannerError | null>(null);
  const queue = usePayoutQueue();

  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const refresh = useCallback(async () => {
    const [p, g] = await Promise.all([fetchMyPost(supabase, guardId), fetchGame(supabase)]);
    if (p) setPost(p);
    if (g) setState(g.state);
  }, [supabase, guardId]);
  usePolling(refresh, POLL_MS);

  const release = useCallback(() => {
    // Jeda singkat: kartu yang sama masih di depan kamera jangan langsung terbaca lagi.
    later(() => {
      busy.current = false;
    }, COOLDOWN_MS);
  }, [later]);

  const showMessage = useCallback(
    (text: string) => {
      setMessage(text);
      later(() => setMessage((m) => (m === text ? null : m)), MESSAGE_MS);
    },
    [later],
  );

  const handle = useCallback(
    async (raw: string) => {
      const qr = parseTeamQr(raw);
      if (!qr) {
        showMessage(MSG_UNKNOWN);
        release();
        return;
      }
      setResolving(true);
      try {
        const res = await resolveTeam({ token: qr.token });
        if (res.ok) {
          setMessage(null);
          // `request_id` dibuat saat form muncul dan dipakai ulang pada percobaan ulang (docs/07 §3.4).
          setTeam({
            requestId: crypto.randomUUID(),
            teamId: res.data.teamId,
            name: res.data.name,
            cash: res.data.cash,
          });
          return; // `busy` tetap terkunci selama form terbuka (pindai ganda diabaikan)
        }
        showMessage(res.retryable ? MSG_NETWORK : res.code === "team_not_found" ? MSG_UNKNOWN : res.message);
      } catch (error) {
        showMessage(isNetworkError(error) ? MSG_NETWORK : MSG_UNKNOWN);
      } finally {
        setResolving(false);
      }
      release();
    },
    [release, showMessage],
  );

  const submitRaw = useCallback(
    (raw: string) => {
      if (busy.current) return;
      busy.current = true;
      void handle(raw);
    },
    [handle],
  );

  const onScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const raw = codes[0]?.rawValue;
      if (raw) submitRaw(raw);
    },
    [submitRaw],
  );

  // SEMENTARA: gambar yang diseret tidak berisi QR yang terbaca.
  const onUnreadable = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    showMessage(MSG_UNKNOWN);
    release();
  }, [release, showMessage]);

  const closeSheet = useCallback(() => {
    setTeam(null);
    setSubmittedAmount(null);
    release();
  }, [release]);

  const send = useCallback(
    (t: SheetTeam, amount: number) => {
      queue.enqueue({ requestId: t.requestId, teamId: t.teamId, teamName: t.name, amount });
      // Form tetap terbuka dan menunjukkan saldo tim naik bertahap; ia menutup sendiri (atau lewat "Lanjut pindai").
      setSubmittedAmount(amount);
    },
    [queue],
  );

  // Keadaan pengiriman hadiah untuk form yang terbuka: masih di antrean, sudah terkirim (ada pemberitahuan sukses), atau gagal.
  const phase: PayoutPhase = !team
    ? "sending"
    : queue.jobs.some((j) => j.requestId === team.requestId && j.status === "failed")
      ? "failed"
      : queue.notices.some((n) => n.id === team.requestId)
        ? "sent"
        : "sending";

  const { number, title } = splitPostName(post.name);
  const banner = BANNER[state];

  return (
    <div className="flex flex-col gap-5">
      <div>
        {number ? (
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Pos {number}
          </p>
        ) : null}
        <h1 className="text-ink text-[32px] leading-[1.15] font-bold tracking-tight">Pindai Hadiah</h1>
      </div>

      {banner ? (
        <p
          role="status"
          className="rounded-panel border-accent bg-accent/12 text-ink border px-4 py-3 text-base font-semibold"
        >
          {banner}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-ink min-w-0 text-lg font-semibold">
          {number ? `Pos ${number} · ${title}` : title}
          {!post.open ? (
            <span className="text-bad-text block text-sm font-medium">
              Pos tidak tersedia: hadiah belum bisa dikirim.
            </span>
          ) : null}
        </p>
        <PostToggle
          open={post.open}
          disabled={state === "finished"}
          onChanged={(open) => setPost((p) => ({ ...p, open }))}
        />
      </div>

      <div
        role="group"
        aria-label="Pratinjau kamera"
        className="rounded-panel bg-card shadow-card border-cyan-text relative aspect-square w-full overflow-hidden border-[3px]"
      >
        {!cameraError ? (
          <Scanner
            onScan={onScan}
            onError={setCameraError}
            formats={["qr_code"]}
            allowMultiple
            scanDelay={250}
            sound={false}
            constraints={{ facingMode: "environment" }}
            components={{ finder: false, torch: false, onOff: false, zoom: false }}
            styles={{
              container: { width: "100%", height: "100%", aspectRatio: "auto" },
              video: { objectFit: "cover" },
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CameraOff className="text-bad-text size-14" aria-hidden />
            <p className="text-ink-muted text-base font-medium">{MSG_CAMERA}</p>
          </div>
        )}

        {!cameraError ? (
          <>
            <div aria-hidden className="absolute top-[34%] left-1/2 size-[116px] -translate-x-1/2">
              <span className="border-cyan-text absolute top-0 left-0 size-7 rounded-tl-[16px] border-t-[3px] border-l-[3px]" />
              <span className="border-cyan-text absolute top-0 right-0 size-7 rounded-tr-[16px] border-t-[3px] border-r-[3px]" />
              <span className="border-cyan-text absolute bottom-0 left-0 size-7 rounded-bl-[16px] border-b-[3px] border-l-[3px]" />
              <span className="border-cyan-text absolute right-0 bottom-0 size-7 rounded-br-[16px] border-r-[3px] border-b-[3px]" />
            </div>
            <p
              role="status"
              className={cn(
                "bg-card/90 text-ink-muted absolute inset-x-5 bottom-5 rounded-full px-4 py-2 text-center text-base font-medium",
              )}
            >
              {resolving ? "Membaca kartu…" : "Arahkan kamera ke QR kartu tim"}
            </p>
          </>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-0">
        {message ? (
          <div className="rounded-panel border-bad-text/40 bg-bad/16 text-bad-text flex items-start gap-3 border px-4 py-3 text-base">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="font-semibold text-balance">{message}</p>
          </div>
        ) : null}
      </div>

      <PayoutNotices
        jobs={queue.jobs}
        notices={queue.notices}
        onRetry={queue.retry}
        onDismiss={queue.dismiss}
        onCloseNotice={queue.closeNotice}
      />

      {DevQrDrop ? <DevQrDrop onRaw={submitRaw} onUnreadable={onUnreadable} disabled={false} /> : null}

      <PayoutSheet
        team={team}
        submittedAmount={submittedAmount}
        phase={phase}
        onSend={send}
        onCancel={closeSheet}
      />
    </div>
  );
}
