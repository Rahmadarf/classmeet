import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Lambang resmi (logo ISSC berwarna, `public/brand/issc-logo.png`, turunan dari `assets/issc-logo.png`). Lebar mengikuti tinggi
 * (rasio 800:424); tinggi diatur lewat `className` (mis. `h-10`). Gambar kecil dan statis, jadi tanpa optimasi Next.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/issc-logo.png"
      alt="ISSC"
      width={800}
      height={424}
      unoptimized
      priority
      className={cn("h-10 w-auto shrink-0", className)}
    />
  );
}
