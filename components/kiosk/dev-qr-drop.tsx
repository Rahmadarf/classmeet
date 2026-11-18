"use client";

/**
 * SEMENTARA, HANYA MODE DEV. Untuk menguji login tim di laptop tanpa kamera: seret (atau pilih/tempel)
 * gambar QR kartu ke /kiosk. Gambar dibaca di peramban (zxing), isinya diteruskan ke jalur login yang
 * sama dengan pemindaian kamera. Tidak ada yang dikirim ke server selain login biasa.
 *
 * Dirender hanya bila `process.env.NODE_ENV !== "production"` (lihat kiosk-scanner.tsx), jadi tidak ikut
 * build produksi. CARA MENGHAPUS: hapus berkas ini, hapus `DevQrDrop` + `submitRaw`/`onUnreadable` pemakainya
 * di components/kiosk/kiosk-scanner.tsx (cari "DevQrDrop"), dan hapus bagian "QR seret (sementara)" di
 * docs/13-log-implementasi.md.
 */
import { ImageUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

async function readQr(file: Blob): Promise<string | null> {
  const { readBarcodes, setZXingModuleOverrides } = await import("zxing-wasm/reader");
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path,
  });
  const results = await readBarcodes(file, { formats: ["QRCode"], tryHarder: true });
  return results.find((r) => r.isValid)?.text ?? null;
}

export function DevQrDrop({
  onRaw,
  onUnreadable,
  disabled,
}: {
  onRaw: (raw: string) => void;
  onUnreadable: () => void;
  disabled: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Pemanggil memberi fungsi baru tiap render; simpan di ref supaya listener window tidak dipasang ulang.
  const handler = useRef({ onRaw, onUnreadable, disabled });
  useEffect(() => {
    handler.current = { onRaw, onUnreadable, disabled };
  });

  useEffect(() => {
    const handleFile = async (file: Blob | null | undefined) => {
      if (!file || handler.current.disabled) return;
      const raw = await readQr(file).catch(() => null);
      if (raw) handler.current.onRaw(raw);
      else handler.current.onUnreadable();
    };
    // Tanpa ini peramban membuka gambar yang dijatuhkan dan meninggalkan halaman.
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setOver(e.type !== "drop" && e.type !== "dragleave");
      }
    };
    const drop = (e: DragEvent) => {
      prevent(e);
      void handleFile(e.dataTransfer?.files[0]);
    };
    const paste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) void handleFile(file);
    };
    window.addEventListener("dragenter", prevent);
    window.addEventListener("dragover", prevent);
    window.addEventListener("dragleave", prevent);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", prevent);
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("dragleave", prevent);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, []);

  return (
    <div
      data-testid="dev-qr-drop"
      className={cn(
        "rounded-panel flex items-center gap-4 border-2 border-dashed px-4 py-3 transition-colors",
        over ? "border-brand-text bg-tint" : "border-line-strong bg-card",
      )}
    >
      <ImageUp className="text-brand-text size-7 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-ink text-base font-semibold">Mode uji (hanya dev): tanpa kamera</p>
        <p className="text-ink-muted text-sm">
          Seret gambar QR kartu ke mana saja di halaman ini, atau tempel (⌘V).
        </p>
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="rounded-control border-line-strong text-ink hover:bg-soft min-h-11 shrink-0 border px-4 text-base font-semibold"
      >
        Pilih gambar
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || handler.current.disabled) return;
          void readQr(file)
            .catch(() => null)
            .then((raw) => (raw ? handler.current.onRaw(raw) : handler.current.onUnreadable()));
        }}
      />
    </div>
  );
}
