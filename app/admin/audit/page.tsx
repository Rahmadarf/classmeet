import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuditBoard } from "@/components/admin/audit-board";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { fetchAuditPage } from "@/lib/admin/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit" };

export default function AuditPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Audit" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const rows = await fetchAuditPage(supabase);
  return (
    <>
      <PageHeader
        eyebrow="Pengawasan"
        title="Audit"
        subtitle="Log perubahan yang ditulis database. Tidak bisa diubah atau dihapus."
      />
      {rows ? (
        <AuditBoard initial={rows} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Log audit belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}
