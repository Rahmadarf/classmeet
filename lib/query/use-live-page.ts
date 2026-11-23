"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { must, pollOptions, seed, seedMaybe } from "@/lib/query/options";

type Options<T> = {
  /** Kunci cache (lihat `qk`). */
  key: readonly unknown[];
  /** Nama sumber untuk pesan galat. */
  label: string;
  fetch: () => Promise<T | null>;
  pollMs: number;
  /** Mati bila `false` (mis. pratinjau tanpa data langsung). */
  enabled?: boolean;
};

/**
 * Papan "data awal dari server lalu polling" (halaman admin dan sejenisnya). `refresh` tetap tersedia untuk dipanggil sesudah aksi atau dari
 * Realtime; `stale` menyala bila pengambilan terakhir gagal (data lama tetap tampil).
 */
export function useLivePage<T>({ initial, ...o }: Options<T> & { initial: T }) {
  const q = useQuery({
    queryKey: o.key,
    queryFn: () => must(o.fetch(), o.label),
    ...pollOptions(o.pollMs),
    ...seed(initial),
    enabled: o.enabled ?? true,
  });
  const { refetch } = q;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  // `initialData` selalu ada, jadi `data` tidak pernah kosong; `?? initial` hanya untuk menenangkan tipe generik.
  return { data: q.data ?? initial, stale: q.isError, refresh };
}

/** Sama, untuk data awal yang boleh `null` (server gagal memuat): Query mengambilnya langsung di browser. */
export function useLivePageMaybe<T>({ initial, ...o }: Options<T> & { initial: T | null }) {
  const q = useQuery({
    queryKey: o.key,
    queryFn: () => must(o.fetch(), o.label),
    ...pollOptions(o.pollMs),
    ...seedMaybe(initial),
    enabled: o.enabled ?? true,
  });
  const { refetch } = q;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  return { data: q.data ?? null, stale: q.isError, refresh };
}
