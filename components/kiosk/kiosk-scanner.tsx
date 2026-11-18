"use client";

import type { IDetectedBarcode, IScannerError, IScannerHandle } from "@yudiel/react-qr-scanner";
import { AlertCircle, CameraOff, Check } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/shell/brand";
import { applyDeviceFromUrl, getKioskDevice } from "@/lib/kiosk/device";
import { authEmail, parseTeamQr } from "@/lib/qr";
import { isNetworkError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Layar masuk laptop trading (docs/07-ui-ux.md §3.3; Figma `Kiosk — Scan QR`, node 1084:320).
 *
 * Alur: halaman SELALU menghapus sesi lama dulu → kamera menyala → QR terbaca sekali →
 * signInWithPassword(akun, rahasia) → log_kiosk_event('login') → /team/market.
 *
 * KEAMANAN: isi QR adalah kredensial. Ia hanya hidup sebagai variabel lokal di `attempt()`; tidak masuk
 * state React, log, URL, atau pesan galat.
 */

const MAX_FAILURES = 5;
const HOLD_SECONDS = 10;
const RETRY_PAUSE_MS = 1500;
const LANDING = "/team/market";

const MSG_UNKNOWN_CARD = "Kartu tidak dikenali. Coba lagi atau minta bantuan panitia.";
const MSG_NETWORK = "Koneksi bermasalah. Coba lagi sebentar lagi.";
const MSG_CAMERA = "Kamera tidak bisa dipakai. Pindah ke laptop lain atau hubungi panitia.";

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

// SEMENTARA (dev saja): login tanpa kamera lewat seret gambar QR. Lihat dev-qr-drop.tsx untuk cara menghapus.
// Dibuat hanya di luar produksi, supaya kode ini tidak ikut terkirim ke build produksi sama sekali.
const DevQrDrop =
  process.env.NODE_ENV !== "production"
    ? dynamic(() => import("./dev-qr-drop").then((m) => m.DevQrDrop), { ssr: false })
    : null;

type Phase = "booting" | "starting" | "ready" | "reading" | "success" | "hold";

export function KioskScanner() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [message, setMessage] = useState<string | null>(null);
  const [holdLeft, setHoldLeft] = useState(0);
  const [cameraError, setCameraError] = useState<IScannerError | null>(null);

  const busy = useRef(false);
  const failures = useRef(0);
  const timers = useRef<number[]>([]);
  const scannerRef = useRef<IScannerHandle | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // 1) Selalu mulai dari keadaan keluar: cabut sesi tim sebelumnya (docs/02 §3.5).
  useEffect(() => {
    let cancelled = false;
    applyDeviceFromUrl();
    (async () => {
      const supabase = createClient();
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.rpc("log_kiosk_event", { p_event: "logout", p_device: getKioskDevice() });
        }
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error) await supabase.auth.signOut({ scope: "local" });
      } catch {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // diabaikan: layar tetap bisa dipakai
        }
      }
      if (!cancelled) setPhase("starting");
    })();
    const pending = timers.current;
    return () => {
      cancelled = true;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // 2) Kamera dianggap aktif begitu aliran video ada.
  useEffect(() => {
    if (phase !== "starting" || cameraError) return;
    const id = window.setInterval(() => {
      if (scannerRef.current?.getStream()?.active) setPhase("ready");
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, cameraError]);

  const startHold = useCallback(() => {
    setPhase("hold");
    setMessage(null);
    setHoldLeft(HOLD_SECONDS);
    const id = window.setInterval(() => {
      setHoldLeft((left) => {
        if (left <= 1) {
          window.clearInterval(id);
          busy.current = false;
          setPhase("ready");
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    timers.current.push(id);
  }, []);

  const fail = useCallback(() => {
    failures.current += 1;
    if (failures.current >= MAX_FAILURES) {
      failures.current = 0;
      startHold();
      return;
    }
    setMessage(MSG_UNKNOWN_CARD);
    setPhase("ready");
    // Jeda singkat: kartu yang sama masih di depan kamera jangan langsung dicoba ulang beruntun.
    later(() => {
      busy.current = false;
    }, RETRY_PAUSE_MS);
  }, [later, startHold]);

  const attempt = useCallback(
    async (raw: string) => {
      const qr = parseTeamQr(raw);
      if (!qr) {
        fail();
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail(qr.username),
        password: qr.token,
      });
      if (error) {
        if (isNetworkError(error)) {
          // Masalah jaringan bukan salah kartu: tidak dihitung sebagai kegagalan.
          setMessage(MSG_NETWORK);
          setPhase("ready");
          later(() => {
            busy.current = false;
          }, RETRY_PAUSE_MS);
          return;
        }
        fail();
        return;
      }
      failures.current = 0;
      setMessage(null);
      setPhase("success");
      try {
        await supabase.rpc("log_kiosk_event", { p_event: "login", p_device: getKioskDevice() });
      } catch {
        // pencatatan gagal tidak boleh menahan tim masuk
      }
      // Muat ulang penuh agar proxy melihat cookie sesi baru.
      // Muat ulang penuh disengaja: proxy harus melihat cookie sesi baru dan tidak ada state kartu yang tersisa.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = LANDING;
    },
    [fail, later],
  );

  const submitRaw = useCallback(
    (raw: string) => {
      if (busy.current) return;
      busy.current = true;
      setMessage(null);
      setPhase("reading");
      void attempt(raw);
    },
    [attempt],
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
    fail();
  }, [fail]);

  const chip = chipFor(phase);
  // Pemindai tidak pernah dijeda: jeda memicu kamera mati-hidup tiap percobaan. Penguncian dilakukan `busy`.
  const showScanner = phase !== "booting" && !cameraError;

  const statusText = cameraError
    ? MSG_CAMERA
    : phase === "hold"
      ? `Terlalu banyak percobaan. Coba lagi dalam ${holdLeft} detik.`
      : message;
  const detail = cameraError ? cameraDetail(cameraError) : null;

  return (
    <main className="bg-page flex min-h-dvh flex-col">
      <div className="px-10 pt-7">
        <Brand />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-8 py-10 lg:flex-row lg:gap-[72px]">
        {/* Pratinjau kamera */}
        <div
          role="group"
          aria-label="Pratinjau kamera"
          className={cn(
            "rounded-panel bg-card shadow-card relative aspect-[4/3] w-full max-w-[560px] shrink-0 overflow-hidden border-[3px]",
            "border-brand-text",
          )}
        >
          {showScanner ? (
            <Scanner
              ref={scannerRef}
              onScan={onScan}
              onError={setCameraError}
              formats={["qr_code"]}
              allowMultiple
              scanDelay={250}
              sound={false}
              constraints={{ facingMode: "user" }}
              components={{ finder: false, torch: false, onOff: false, zoom: false }}
              styles={{
                container: { width: "100%", height: "100%", aspectRatio: "auto" },
                video: { objectFit: "cover", transform: "scaleX(-1)" },
              }}
            />
          ) : null}

          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <CameraOff className="text-bad-text size-16" aria-hidden />
              <p className="text-ink-muted text-lg font-medium">Kamera tidak aktif</p>
            </div>
          ) : (
            <ScanCorners onVideo={phase !== "starting" && phase !== "booting"} />
          )}

          {!cameraError ? (
            <div className="absolute inset-x-0 bottom-5 flex justify-center">
              <span
                className="border-line bg-card text-ink-muted shadow-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-lg font-medium"
                role="status"
              >
                {chip.icon === "check" ? (
                  <Check className="text-ok-text size-5" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-full", chip.live ? "bg-cyan-text" : "bg-line-strong")}
                  />
                )}
                {chip.text}
              </span>
            </div>
          ) : null}
        </div>

        {/* Teks */}
        <div className="flex w-full max-w-[460px] flex-col gap-4">
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Classmeet Market
          </p>
          <h1 className="text-ink text-[40px] leading-[1.15] font-bold">Scan QR untuk trading</h1>
          <p className="text-ink-muted text-xl leading-[1.4]">
            Dekatkan kartu timmu ke kamera. Kartu terbaca sekali, lalu kamu langsung masuk ke Pasar.
          </p>

          {/* Ruang tetap supaya tata letak tidak bergeser saat pesan muncul. */}
          <div aria-live="polite" aria-atomic="true" className="min-h-[76px]">
            {statusText ? (
              <div className="rounded-panel border-bad-text/40 bg-bad/16 text-bad-text flex items-start gap-3 border px-4 py-3 text-lg">
                <AlertCircle className="mt-0.5 size-6 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold text-balance">{statusText}</p>
                  {detail ? <p className="mt-1 text-base font-normal">{detail}</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          {DevQrDrop ? (
            <DevQrDrop onRaw={submitRaw} onUnreadable={onUnreadable} disabled={phase === "booting"} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function chipFor(phase: Phase): { text: string; live: boolean; icon?: "check" } {
  switch (phase) {
    case "booting":
    case "starting":
      return { text: "Menyalakan kamera…", live: false };
    case "reading":
      return { text: "Membaca kartu…", live: true };
    case "success":
      return { text: "Kartu terbaca. Masuk…", live: true, icon: "check" };
    case "hold":
      return { text: "Menunggu sebentar…", live: false };
    default:
      return { text: "Kamera aktif", live: true };
  }
}

function cameraDetail(error: IScannerError): string | null {
  switch (error.kind) {
    case "permission-denied":
      return "Izin kamera ditolak. Izinkan kamera untuk halaman ini, lalu muat ulang.";
    case "insecure-context":
      return "Kamera hanya bisa dipakai lewat HTTPS.";
    case "in-use":
      return "Kamera sedang dipakai aplikasi lain.";
    default:
      return null;
  }
}

/** Sudut bidik. Dua lapis (putih di bawah, teal di atas) supaya terbaca di atas gambar kamera maupun kartu putih. */
function ScanCorners({ onVideo }: { onVideo: boolean }) {
  const d =
    "M6 62 V30 a24 24 0 0 1 24-24 H62 M138 6 H170 a24 24 0 0 1 24 24 V62 M194 138 V170 a24 24 0 0 1-24 24 H138 M62 194 H30 a24 24 0 0 1-24-24 V138";
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute top-1/2 left-1/2 size-[260px] -translate-x-1/2 -translate-y-[58%]"
      fill="none"
      strokeLinecap="round"
    >
      {onVideo ? <path d={d} stroke="#fff" strokeWidth="11" /> : null}
      <path d={d} stroke="var(--cyan-text)" strokeWidth="4" />
    </svg>
  );
}
