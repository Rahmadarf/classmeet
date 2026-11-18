"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { awardPayout } from "@/app/guard/actions";
import type { ActionResult } from "@/lib/schemas/common";
import {
  backoffMs,
  failureReason,
  MAX_AUTO_ATTEMPTS,
  parseJobs,
  serializeJobs,
  STORAGE_KEY,
  successText,
  type PayoutJob,
} from "./queue";

export type SuccessNotice = { id: string; text: string };

const SUCCESS_MS = 8_000;

/**
 * Antrean hadiah lokal dengan percobaan ulang (docs/07 §3.4). `enqueue` mengembalikan kendali seketika; pengiriman
 * berjalan di latar belakang dengan `request_id` yang SAMA tiap percobaan. Jaringan putus: ulang otomatis dengan jeda
 * naik (maks. 5 kali); galat tetap (pos ditutup, game selesai, dst.): langsung gagal dan menunggu "Kirim ulang".
 * Yang belum terkirim disimpan di peramban dan dilanjutkan saat halaman dibuka lagi.
 */
export function usePayoutQueue() {
  const [jobs, setJobs] = useState<PayoutJob[]>([]);
  const [notices, setNotices] = useState<SuccessNotice[]>([]);
  const inflight = useRef(new Set<string>());
  const timers = useRef(new Set<number>());
  const loaded = useRef(false);
  const attemptRef = useRef<(job: PayoutJob) => Promise<void>>(async () => {});

  const patch = useCallback((requestId: string, change: Partial<PayoutJob>) => {
    setJobs((prev) => prev.map((j) => (j.requestId === requestId ? { ...j, ...change } : j)));
  }, []);

  const attempt = useCallback(
    async (job: PayoutJob) => {
      if (inflight.current.has(job.requestId)) return;
      inflight.current.add(job.requestId);
      let res: ActionResult;
      try {
        res = await awardPayout({ requestId: job.requestId, teamId: job.teamId, amount: job.amount });
      } catch {
        res = { ok: false, message: "Koneksi bermasalah. Coba lagi.", code: null, retryable: true };
      }
      inflight.current.delete(job.requestId);

      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.requestId !== job.requestId));
        const id = job.requestId;
        setNotices((prev) => [...prev, { id, text: successText(job) }]);
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          setNotices((prev) => prev.filter((n) => n.id !== id));
        }, SUCCESS_MS);
        timers.current.add(t);
        return;
      }

      if (res.retryable && job.attempts + 1 < MAX_AUTO_ATTEMPTS) {
        const next = { ...job, attempts: job.attempts + 1 };
        patch(job.requestId, { attempts: next.attempts });
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          void attemptRef.current(next);
        }, backoffMs(job.attempts));
        timers.current.add(t);
        return;
      }
      patch(job.requestId, { status: "failed", reason: failureReason(res.code, res.message) });
    },
    [patch],
  );

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  // Muat antrean tersimpan (hadiah yang belum terkirim sebelum halaman ditutup) lalu lanjutkan pengirimannya.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = parseJobs(window.localStorage.getItem(STORAGE_KEY));
      loaded.current = true;
      if (saved.length === 0) return;
      setJobs((prev) => [...saved.filter((s) => !prev.some((p) => p.requestId === s.requestId)), ...prev]);
      for (const job of saved) if (job.status === "sending") void attemptRef.current(job);
    }, 0);
    const pending = timers.current;
    return () => {
      window.clearTimeout(id);
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeJobs(jobs));
    } catch {
      // penyimpanan penuh/dinonaktifkan: antrean tetap berjalan di memori
    }
  }, [jobs]);

  // Jangan tutup halaman diam-diam saat masih ada hadiah yang sedang dikirim.
  const sending = jobs.some((j) => j.status === "sending");
  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  const enqueue = useCallback(
    (input: { requestId: string; teamId: string; teamName: string; amount: number }) => {
      const job: PayoutJob = { ...input, status: "sending", attempts: 0, reason: null };
      setJobs((prev) => (prev.some((j) => j.requestId === job.requestId) ? prev : [...prev, job]));
      void attempt(job);
    },
    [attempt],
  );

  const retry = useCallback(
    (requestId: string) => {
      const job = jobs.find((j) => j.requestId === requestId);
      if (!job || job.status !== "failed") return;
      const next: PayoutJob = { ...job, status: "sending", attempts: 0, reason: null };
      patch(requestId, { status: "sending", attempts: 0, reason: null });
      void attempt(next);
    },
    [jobs, patch, attempt],
  );

  const dismiss = useCallback((requestId: string) => {
    setJobs((prev) => prev.filter((j) => !(j.requestId === requestId && j.status === "failed")));
  }, []);

  const closeNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { jobs, notices, enqueue, retry, dismiss, closeNotice };
}
