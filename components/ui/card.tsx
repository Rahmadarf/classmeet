import * as React from "react";
import { cn } from "@/lib/utils";

/** Kartu panel: putih, radius 10, garis --border, bayangan biru halus (DESIGN.md §6; radius dari skala implementasi). */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <section
      className={cn("rounded-panel border-line bg-card shadow-card border p-6", className)}
      {...props}
    />
  );
}

/** Eyebrow + judul kartu (pola umum di dalam kartu). */
export function CardHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">{eyebrow}</p>
        ) : null}
        <h2 className="text-ink text-2xl leading-tight font-semibold">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
