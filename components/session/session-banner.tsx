"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { endSession } from "@/lib/session/end-session";

/** Batas diam 5 menit; banner muncul di 30 detik terakhir (docs/07 §2.1, DESIGN.md §6). */
export const IDLE_MS = 5 * 60 * 1000;
export const WARN_MS = 30 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "pointermove"] as const;
/** Gerakan kursor lebih kecil dari ini diabaikan: tata letak yang bergeser bisa memicu pointermove palsu. */
const MIN_MOVE_PX = 4;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Keluar otomatis di laptop trading (docs/02 §3.5): 5 menit tanpa sentuhan, papan ketik, atau gerakan
 * → `log_kiosk_event('idle_logout')` + signOut global + kembali ke /kiosk. Di 30 detik terakhir tampil
 * banner kuning di paling atas area isi; sentuhan apa pun menutupnya dan mengulang 5 menit.
 *
 * Waktu dihitung dari jam dinding (bukan hitungan interval) agar tab latar yang di-throttle browser
 * tetap keluar tepat waktu.
 */
export function SessionBanner({
  idleMs = IDLE_MS,
  warnMs = WARN_MS,
}: {
  /** Hanya untuk galeri /dev (uji cepat). Produksi memakai bawaan 5 menit / 30 detik. */
  idleMs?: number;
  warnMs?: number;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastActivity = useRef<number>(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    lastActivity.current = Date.now();

    const tick = () => {
      const left = idleMs - (Date.now() - lastActivity.current);
      if (left <= 0) {
        void endSession("idle_logout");
        return;
      }
      setRemaining(left <= warnMs ? Math.ceil(left / 1000) : null);
    };

    const onActivity = (event: Event) => {
      if (event.type === "pointermove") {
        const e = event as PointerEvent;
        const prev = lastPoint.current;
        lastPoint.current = { x: e.screenX, y: e.screenY };
        if (prev && Math.abs(e.screenX - prev.x) + Math.abs(e.screenY - prev.y) < MIN_MOVE_PX) return;
      }
      lastActivity.current = Date.now();
      setRemaining((r) => (r === null ? r : null));
    };

    const interval = window.setInterval(tick, 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [idleMs, warnMs]);

  if (remaining === null) return null;

  return (
    <div
      role="alert"
      className="bg-accent-2 text-ink-on-accent sticky top-0 z-40 flex items-center gap-3.5 px-8 py-3.5"
    >
      <Clock className="size-6 shrink-0" aria-hidden />
      <div className="flex-1 leading-tight">
        <p className="text-base font-bold">Sesi segera berakhir</p>
        <p className="text-sm font-medium">Sentuh layar untuk melanjutkan.</p>
      </div>
      <span className="tnum bg-card text-ink shadow-card ring-pulse rounded-full px-4 py-2 text-xl font-bold">
        Keluar dalam {formatCountdown(remaining)}
      </span>
    </div>
  );
}
