import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrdersBoard } from "@/components/orders/orders-board";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/states";
import {
  fetchAssetNames,
  fetchClosedOrders,
  fetchGame,
  fetchHoldings,
  fetchOpenOrders,
} from "@/lib/market/data";
import { isTodayWib } from "@/lib/orders/view";
import { createClient } from "@/lib/supabase/server";
import { fetchSummary } from "@/lib/team/data";

export const metadata: Metadata = { title: "Order" };

const SUBTITLE = "Order yang masih antre. Saldo atau aset yang dikunci kembali saat order dibatalkan.";

export default function OrdersPage() {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}

/** Semua data awal halaman. Dipisah dari komponen karena "hari ini" memakai jam (tidak boleh murni di render). */
async function loadOrders() {
  const supabase = await createClient();
  const [game, open, closed, holdings, summary, names] = await Promise.all([
    fetchGame(supabase),
    fetchOpenOrders(supabase),
    fetchClosedOrders(supabase),
    fetchHoldings(supabase),
    fetchSummary(supabase),
    fetchAssetNames(supabase),
  ]);
  if (!game || !open || !closed || !holdings || !names) return null;
  return {
    game,
    open,
    closedToday: isTodayWib(closed, Date.now()),
    holdings,
    lockedCash: summary?.lockedCash ?? null,
    names,
  };
}

async function OrdersContent() {
  await connection(); // klien Supabase memakai waktu (JWT) dan "hari ini" dihitung saat permintaan
  const initial = await loadOrders();

  if (!initial) {
    return (
      <>
        <PageHeader eyebrow="Lantai perdagangan" title="Order Terbuka" subtitle={SUBTITLE} />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data order belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Lantai perdagangan" title="Order Terbuka" subtitle={SUBTITLE} />
      <OrdersBoard initial={initial} />
    </>
  );
}

function OrdersSkeleton() {
  return (
    <div role="status" aria-label="Memuat order">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-[34rem] max-w-full" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[110px]" />
        <Skeleton className="h-[110px]" />
        <Skeleton className="h-[110px]" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-52" />
        <Skeleton className="h-60" />
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
