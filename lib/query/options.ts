import type { QueryClientConfig } from "@tanstack/react-query";

/**
 * Semua fungsi `fetchX` di lib/*\/data.ts mengembalikan `null` saat gagal (tidak melempar). TanStack Query hanya
 * tahu sebuah pengambilan gagal bila fungsinya melempar, jadi bungkus dengan `must`: data lama tetap tampil dan
 * `isError`/`isRefetchError` menyala (pengganti penanda `stale` di papan-papan sebelumnya).
 */
export async function must<T>(task: Promise<T | null>, label: string): Promise<T> {
  const value = await task;
  if (value === null) throw new Error(`${label}: gagal dimuat`);
  return value;
}

/**
 * Opsi polling bersama:
 *  - ambil ulang tiap `intervalMs` hanya saat tab terlihat (`refetchIntervalInBackground: false`);
 *  - data awal dari server dianggap baru selama setengah interval, jadi TIDAK diambil ulang saat pertama dipasang,
 *    tetapi diambil ulang saat halaman muncul kembali / tab aktif lagi / koneksi tersambung sesudah itu.
 */
export function pollOptions(intervalMs: number) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    staleTime: Math.floor(intervalMs / 2),
  } as const;
}

/**
 * Data awal dari server (RSC) sebagai `initialData`. `initialDataUpdatedAt` berupa fungsi supaya jam dibaca saat
 * Query membutuhkannya, bukan saat render (jam tidak boleh dibaca di render).
 * `seed` untuk data yang pasti ada; `seedMaybe` untuk data yang bisa `null` (server gagal memuat): tanpa data awal,
 * Query langsung mengambilnya di browser.
 */
export function seed<T>(data: T) {
  return { initialData: data, initialDataUpdatedAt: () => Date.now() } as const;
}

export function seedMaybe<T>(data: T | null | undefined) {
  return { initialData: data ?? undefined, initialDataUpdatedAt: () => Date.now() } as const;
}

/**
 * Bawaan seluruh aplikasi:
 *  - `retry: false`: sama dengan perilaku lama. Kegagalan sementara ditangani ketukan polling berikutnya, dan galat
 *    aturan game (mis. `insufficient_cash`) tidak boleh diulang otomatis.
 *  - ambil ulang saat fokus/online tetap menyala (bawaan Query).
 */
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
      gcTime: 5 * 60_000,
    },
    mutations: { retry: false },
  },
};
