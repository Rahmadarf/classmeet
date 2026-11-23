import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { TransactionsBoard } from "@/components/admin/transactions-board";
import { PageHeader } from "@/components/shell/page-header";
import { fetchAnalysisLog, fetchTransactionsPage } from "@/lib/admin/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Transaksi" };

const SUBTITLE = "Beli dan jual tim ke pasar, serta keadaan stok tiap aset. Tampilan saja.";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Transaksi" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const [page, analysis] = await Promise.all([fetchTransactionsPage(supabase), fetchAnalysisLog(supabase)]);
  if (!page) {
    return (
      <>
        <PageHeader eyebrow="Pengawasan" title="Transaksi" subtitle={SUBTITLE} />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data transaksi belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }
  return <TransactionsBoard initial={page} analysis={analysis} />;
}
