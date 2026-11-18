import { connection } from "next/server";
import { Suspense } from "react";
import { GuardShell } from "@/components/guard/guard-shell";
import { fetchMyPost, splitPostName } from "@/lib/guard/data";
import { createClient } from "@/lib/supabase/server";

export default function GuardLayout({ children }: { children: React.ReactNode }) {
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
  const number = post ? splitPostName(post.name).number : null;
  return (
    <GuardShell
      name={profile?.display_name || profile?.username || "Penjaga"}
      postLabel={number ? `Pos ${number}` : "Penjaga"}
    >
      {children}
    </GuardShell>
  );
}
