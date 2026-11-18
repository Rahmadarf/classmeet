import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PayoutsBoard } from "@/components/admin/payouts-board";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { fetchPayoutsPage } from "@/lib/admin/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hadiah" };

export default function PayoutsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Hadiah" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const page = await fetchPayoutsPage(supabase);
  if (!page) {
    return (
      <>
        <PageHeader eyebrow="Pengawasan" title="Hadiah" />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data hadiah belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }
  return <PayoutsBoard initial={page} />;
}
