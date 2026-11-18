"use client";

import { Menu, ScanLine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { AccountCard } from "@/components/shell/app-shell";
import { Brand } from "@/components/shell/brand";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * Cangkang penjaga (ponsel; docs/07 §0.1): bilah atas tetap dengan tombol menu (☰) di kiri + logo, dan laci dari kiri
 * berisi menu (hanya "Pindai") serta kartu akun dengan tombol Keluar. Target sentuh ≥ 44 px.
 */
export function GuardShell({
  name,
  postLabel,
  children,
}: {
  name: string;
  /** Mis. "Pos 3"; ditampilkan sebagai peran di kartu akun. */
  postLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-page flex min-h-dvh flex-col">
      <header className="border-line bg-sidebar sticky top-0 z-30 flex items-center gap-3 border-b px-5 py-3.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="rounded-control bg-nav-active text-brand-text hover:bg-tint grid size-11 shrink-0 place-items-center"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Brand subtitle="Penjaga" />
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 py-5">{children}</main>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Menu penjaga</SheetTitle>
          <SheetDescription className="sr-only">Navigasi dan keluar dari akun penjaga.</SheetDescription>
          <Brand subtitle="Penjaga" />
          <nav aria-label="Navigasi" className="flex-1">
            <Link
              href="/guard/scan"
              aria-current="page"
              onClick={() => setOpen(false)}
              className="rounded-row bg-nav-active text-brand-text flex min-h-12 items-center gap-3 px-4 text-lg font-semibold"
            >
              <ScanLine className="size-5" aria-hidden />
              Pindai
            </Link>
          </nav>
          <AccountCard name={name} roleLabel={postLabel}>
            <AdminSignOut />
          </AccountCard>
        </SheetContent>
      </Sheet>
    </div>
  );
}
