import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";
import { Brand } from "@/components/shell/brand";
import { Card } from "@/components/ui/card";
import { ROLE_HOME, isAppRole } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginContent />
    </Suspense>
  );
}

/**
 * Sudah masuk → langsung ke beranda perannya (tim: pakai kartu QR, jadi tetap diarahkan ke /team).
 * Pengecualian: sesi `display`. Sesi itu didapat otomatis saat `/display` dibuka (tanpa login), jadi bukan identitas yang
 * dipilih pengguna; formulir tetap ditampilkan supaya admin/penjaga bisa masuk dari peramban yang sama.
 */
async function LoginContent() {
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (isAppRole(profile?.role) && profile.role !== "display") redirect(ROLE_HOME[profile.role]);
  }
  return <LoginShell form />;
}

function LoginShell({ form = false }: { form?: boolean }) {
  return (
    <main className="bg-page grid min-h-dvh place-items-center px-6 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <Brand />
        <Card className="flex flex-col gap-5 p-8">
          <div>
            <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Panitia</p>
            <h1 className="text-ink text-[32px] leading-tight font-bold">Masuk</h1>
            <p className="text-ink-muted mt-1.5 text-lg">Untuk admin, penjaga pos, dan layar publik.</p>
          </div>
          {form ? <LoginForm /> : <div className="bg-field h-48 rounded-lg" aria-hidden />}
        </Card>
        <p className="text-ink-muted text-center text-base">
          Tim tidak masuk di sini. Pindai kartu QR di laptop trading.
        </p>
      </div>
    </main>
  );
}
