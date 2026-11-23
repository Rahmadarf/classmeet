"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { queryClientConfig } from "@/lib/query/options";

/**
 * Penyedia cache TanStack Query. Dipasang di tiap layout area yang butuh data langsung (tim, admin, guard, display),
 * BUKAN di layout akar: berpindah akun (keluar lalu masuk sebagai tim lain) melewati /login di luar penyedia ini,
 * sehingga cache akun sebelumnya ikut terbuang dan tidak pernah tampil di akun berikutnya.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient(queryClientConfig));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
