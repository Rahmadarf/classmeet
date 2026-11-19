"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { COUNT_UP_EASE, COUNT_UP_MS } from "@/lib/guard/count-up";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Angka Rupiah yang berhitung naik dari `from` ke `to` dengan library `motion` (`animate` pada MotionValue).
 * Nilai ditulis langsung ke teks DOM tiap frame tanpa merender ulang React, jadi gerakannya mulus. Pembulatan ke
 * bilangan bulat hanya pada teks tampilan; nilai akhir selalu tepat `to`. Gerak dikurangi
 * (`prefers-reduced-motion`): langsung `to`. `onDone` dipanggil sekali saat angka sampai di `to`.
 * `aria-hidden`: pembaca layar tidak membacakan tiap angka; sediakan teks hasil akhir di tempat lain.
 */
export function AnimatedRupiah({
  from,
  to,
  onDone,
  className,
}: {
  from: number;
  to: number;
  onDone?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const value = useMotionValue(from);
  const text = useTransform(value, (v) => formatRupiah(Math.round(v)));

  useEffect(() => {
    if (reduce) {
      value.set(to);
      onDone?.();
      return;
    }
    const controls = animate(value, to, {
      duration: COUNT_UP_MS / 1000,
      ease: COUNT_UP_EASE,
      onComplete: () => {
        value.set(to);
        onDone?.();
      },
    });
    return () => controls.stop();
    // Dijalankan sekali per tampilan: `from`/`to` tidak berubah selama form terbuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.p aria-hidden className={cn("money", className)}>
      {text}
    </motion.p>
  );
}
