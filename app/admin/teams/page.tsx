import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { TeamsBoard } from "@/components/admin/teams-board";
import { PageHeader } from "@/components/shell/page-header";
import { fetchTeamsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tim" };

const SUBTITLE = "Saldo, nilai aset, dan peringkat langsung. Hanya admin yang melihat peringkat.";

export default function TeamsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Tim" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const [rows, game] = await Promise.all([fetchTeamsPage(supabase), fetchAdminGame(supabase)]);
  return (
    <>
      <PageHeader eyebrow="Peserta" title="Tim" subtitle={SUBTITLE} />
      {rows && game ? (
        <TeamsBoard initial={rows} initialGame={game} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data tim belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}
