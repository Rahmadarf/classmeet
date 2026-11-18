import * as React from "react";
import { cn } from "@/lib/utils";

/** Tiga baris yang sama di setiap halaman: eyebrow, judul, subjudul; chip/filter di kanan (docs/07 §0.2). */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-brand-text mb-1 text-[13px] font-semibold tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-ink text-[32px] leading-[1.15] font-bold tracking-tight lg:text-[40px]">
          {title}
        </h1>
        {subtitle ? <p className="text-ink-muted mt-1.5 text-lg">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
