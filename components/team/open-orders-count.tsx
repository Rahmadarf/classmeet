"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { usePolling } from "@/lib/hooks/use-polling";
import { fetchOpenOrderCount } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/client";

const COUNT_POLL_MS = 10_000;
const ORDERS_HREF = "/team/orders";

type Ctx = { count: number; setCount: (n: number) => void };
const OpenOrdersCountContext = createContext<Ctx | null>(null);

/**
 * Jumlah order antre untuk lencana menu "Order" di SEMUA layar tim (docs/12 §9). Nilai awal dari server;
 * halaman Pasar/Order memperbaruinya begitu daftar order mereka berubah (`setCount`), dan penyedia ini
 * mengambil ulang sendiri tiap 10 dtk supaya lencana tetap benar di Beranda dan halaman lain.
 */
export function OpenOrdersCountProvider({ initial, children }: { initial: number; children: ReactNode }) {
  const [count, setCountState] = useState(initial);
  const setCount = useCallback((n: number) => setCountState(n), []);
  const supabase = useMemo(() => createClient(), []);

  usePolling(async () => {
    const n = await fetchOpenOrderCount(supabase);
    if (n !== null) setCountState(n);
  }, COUNT_POLL_MS);

  const value = useMemo(() => ({ count, setCount }), [count, setCount]);
  return <OpenOrdersCountContext.Provider value={value}>{children}</OpenOrdersCountContext.Provider>;
}

/** Dipakai halaman yang tahu daftar order antre terbaru. Di luar penyedia: tidak berbuat apa-apa. */
export function useSetOpenOrdersCount(): (n: number) => void {
  return useContext(OpenOrdersCountContext)?.setCount ?? (() => {});
}

/** Menu sidebar tim dengan lencana Order yang hidup. */
export function TeamNav({ items }: { items: NavItem[] }) {
  const count = useContext(OpenOrdersCountContext)?.count ?? 0;
  return (
    <SidebarNav
      items={items.map((item) =>
        item.href === ORDERS_HREF ? { ...item, badge: count > 0 ? count : undefined } : item,
      )}
    />
  );
}
