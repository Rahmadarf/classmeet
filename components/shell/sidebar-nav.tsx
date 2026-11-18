"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  /** Elemen ikon yang sudah dirender, mis. <Home /> (komponen fungsi tidak bisa dilewatkan dari server ke klien). */
  icon: ReactNode;
  /** Lencana jumlah (mis. order antre). */
  badge?: number;
};

/** Item aktif: --nav-active + penanda oranye 3 px di tepi kiri + teks/ikon --blue-text (DESIGN.md §6). */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Hanya SATU item aktif: yang href-nya paling spesifik. Tanpa ini "Beranda" (/team) ikut menyala di /team/market.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-2">
      {items.map(({ href, label, icon, badge }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-panel relative flex min-h-11 items-center gap-3.5 px-4 py-3 text-[18px] transition-colors",
              active
                ? "bg-nav-active text-brand-text font-semibold"
                : "text-ink-muted hover:bg-soft hover:text-ink font-medium",
            )}
          >
            {active ? (
              <span aria-hidden className="bg-accent absolute top-2 bottom-2 left-0 w-[3px] rounded-full" />
            ) : null}
            <span aria-hidden className="shrink-0 [&>svg]:size-[22px]">
              {icon}
            </span>
            <span className="flex-1">{label}</span>
            {badge ? (
              <span className="tnum bg-primary text-on-primary min-w-6 rounded-full px-2 py-0.5 text-center text-[13px] font-bold">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
