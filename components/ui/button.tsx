import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Satu aksi utama per layar = `primary` (DESIGN.md §3.2). Oranye tidak pernah menjadi tombol.
 * Radius tombol 8 (skala implementasi). Tinggi min. 44 px (target sentuh), `lg` 56 px.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold transition-colors " +
    "disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover disabled:opacity-45",
        secondary:
          "border-2 border-brand-text bg-card text-brand-text hover:bg-soft active:bg-tint disabled:opacity-45",
        soft: "bg-tint text-ink hover:bg-soft active:bg-tint disabled:opacity-45",
        // Aksi berbahaya: garis + teks, bukan isian besar (DESIGN.md §3.2).
        danger:
          "border-2 border-bad-text bg-card text-bad-text hover:bg-soft active:bg-tint disabled:opacity-45",
        ghost: "text-ink-muted hover:bg-soft active:bg-tint disabled:opacity-45",
      },
      size: {
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-11 px-4 text-base",
        lg: "min-h-14 px-5 text-lg",
        // Tombol ikon persegi (lihat IconButton): target sentuh 44 px, versi tabel 36 px.
        icon: "size-11 p-0",
        iconSm: "size-9 p-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Aksi berjalan: tombol dinonaktifkan dan menampilkan teks "Memproses…" supaya tidak ditekan dua kali. */
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    loading,
    loadingText = "Memproses…",
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
});
