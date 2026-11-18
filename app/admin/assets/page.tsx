import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AssetsBoard } from "@/components/admin/assets-board";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { fetchAssetsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aset" };

export default function AssetsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Aset" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const [assets, game] = await Promise.all([fetchAssetsPage(supabase), fetchAdminGame(supabase)]);
  if (!assets || !game) {
    return (
      <>
        <PageHeader
          eyebrow="Pasar"
          title="Aset"
          subtitle="Harga, rentang harga, dan stok bandar tiap aset."
        />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data aset belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }
  return <AssetsBoard initial={assets} locked={game.startedAt !== null} />;
}
