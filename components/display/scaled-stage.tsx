"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Panggung 1920×1080 yang diskalakan agar pas di layar mana pun (proyektor 1280×720, TV 1080p, laptop), dipusatkan
 * dengan latar halaman di sisa ruang. Layar publik dirancang tepat di 1920×1080 (Figma), jadi skala menjaga
 * proporsi dan tata letak apa adanya; tidak ada gulir. Disembunyikan sampai ukuran terukur (tanpa kedip salah ukuran).
 */
export function ScaledStage({
  children,
  width = 1920,
  height = 1080,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) setScale(Math.min(clientWidth / width, clientHeight / height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={host} className="bg-page absolute inset-0 overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          transformOrigin: "center",
          opacity: scale === null ? 0 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
