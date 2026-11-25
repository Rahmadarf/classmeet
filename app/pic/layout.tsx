import { connection } from "next/server";
import { Suspense } from "react";
import { GuardShell } from "@/components/guard/guard-shell";
import { fetchMyPost, splitPostName } from "@/lib/guard/data";
import { QueryProvider } from "@/lib/query/provider";
import { createClient } from "@/lib/supabase/server";

/** Cangkang PIC lomba: sama dengan cangkang penjaga (ponsel), dengan subjudul "PIC Lomba" dan menu Pindai milik /pic. */
export default function PicLayout({ children }: { children: React.ReactNode }) {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-page min-h-dvh" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [{ data: profile }, post] = await Promise.all([
    userId
      ? supabase.from("profiles").select("display_name,username").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId ? fetchMyPost(supabase, userId) : Promise.resolve(null),
  ]);
  const label = post ? splitPostName(post.name).label : null;
  return (
    <QueryProvider>
      <GuardShell
        name={profile?.display_name || profile?.username || "PIC Lomba"}
        postLabel={label ?? "PIC Lomba"}
        subtitle="PIC Lomba"
        scanHref="/pic/scan"
      >
        {children}
      </GuardShell>
    </QueryProvider>
  );
}
