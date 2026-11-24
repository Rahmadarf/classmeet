"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "size" | "aria-label"> {
  icon: LucideIcon;
  /** Nama aksi untuk pembaca layar (`aria-label`) dan isi tooltip. */
  label: string;
  /** Isi tooltip bila berbeda dari `label` (mis. alasan tombol nonaktif). */
  tooltip?: React.ReactNode;
  size?: "icon" | "iconSm";
}

/**
 * Tombol ikon (lucide-react) dengan tooltip. Tanpa teks di tombol, jadi `label` wajib sebagai nama aksesibel. Tombol
 * nonaktif dibungkus `span` yang bisa difokus supaya tooltip (alasan nonaktif) tetap muncul saat disorot atau difokus
 * (elemen `disabled` tidak menerima pointer/fokus).
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tooltip, size = "iconSm", disabled, loading, ...props },
  ref,
) {
  const inactive = Boolean(disabled || loading);
  const button = (
    <Button
      ref={ref}
      size={size}
      disabled={disabled}
      loading={loading}
      loadingText=""
      aria-label={label}
      {...props}
    >
      <Icon className="size-5" aria-hidden />
    </Button>
  );
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {inactive ? (
            <span
              tabIndex={0}
              className="rounded-control focus-visible:outline-primary inline-flex focus-visible:outline-2"
            >
              {button}
            </span>
          ) : (
            button
          )}
        </TooltipTrigger>
        <TooltipContent className="px-3 py-2 text-sm">{tooltip ?? label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
