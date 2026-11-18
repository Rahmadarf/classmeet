import * as React from "react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { SidebarNav, type NavItem } from "./sidebar-nav";

/**
 * Cangkang tim dan admin (laptop ≥ 1024 px): sidebar putih 260 px + isi. Tanpa bilah atas
 * (docs/07-ui-ux.md §0.1). Bilah atas + laci ponsel milik penjaga dibangun saat Tahap Penjaga dikerjakan.
 *
 * `banner` (mis. sesi hampir habis, pasar dijeda, offline) dirender di paling atas area isi.
 */
export function AppShell({
  nav,
  navigation,
  brandSubtitle,
  account,
  banner,
  children,
  contentClassName,
}: {
  /** Menu statis. Diabaikan bila `navigation` diberikan. */
  nav?: NavItem[];
  /** Teks kecil di bawah "CLASSMEET" (mis. "Admin"); bawaan "Market". */
  brandSubtitle?: string;
  /** Pengganti menu bawaan (mis. menu dengan lencana yang hidup, dirender oleh komponen klien). */
  navigation?: React.ReactNode;
  /** Kartu akun di dasar sidebar (lihat AccountCard). */
  account: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside
        className="border-line bg-sidebar sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-6 border-r p-4 lg:flex"
        aria-label="Navigasi"
      >
        <Brand subtitle={brandSubtitle} />
        <div className="flex-1 overflow-y-auto">{navigation ?? <SidebarNav items={nav ?? []} />}</div>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        {/* Di bawah 1024 px sidebar disembunyikan: tim dan admin bekerja dari laptop. */}
        <header className="border-line bg-sidebar flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Brand subtitle={brandSubtitle} />
        </header>
        <main
          className={cn(
            "mx-auto w-full max-w-[1280px] flex-1 px-[18px] py-6 lg:px-8 lg:py-8",
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Kartu akun di dasar sidebar: ubin inisial, nama, peran, lalu satu tombol (Selesai untuk tim, Keluar untuk admin). */
export function AccountCard({
  name,
  roleLabel,
  status,
  children,
}: {
  name: string;
  roleLabel: string;
  /** Baris status koneksi (admin). */
  status?: React.ReactNode;
  /** Tombol Selesai/Keluar. */
  children?: React.ReactNode;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="rounded-panel border-line bg-sidebar-card flex flex-col gap-3 border p-3.5">
      <div className="flex items-center gap-3">
        <span className="rounded-control bg-tint text-ink grid size-10 shrink-0 place-items-center text-sm font-bold">
          {initials || "?"}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="text-ink block truncate text-[15px] font-semibold">{name}</span>
          <span className="text-ink-muted block text-sm">{roleLabel}</span>
        </span>
      </div>
      {status}
      {children}
    </div>
  );
}
