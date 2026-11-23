import { Download } from "lucide-react";

/**
 * Kartu QR tim sebagai GAMBAR (data URI dari server; token tidak pernah jadi teks) + tautan unduh PNG. Dipakai dialog "Tambah tim"
 * dan "Lihat QR" supaya tampilannya sama.
 */
export function QrCard({ qr, name, username }: { qr: string | null; name: string; username: string }) {
  if (!qr)
    return (
      <p role="alert" className="text-bad-text text-base font-semibold">
        Gambar QR gagal dibuat. Cetak kartunya lewat <code>npm run print-qr</code> memakai berkas seed.
      </p>
    );
  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI dari server, bukan aset statis */}
      <img
        src={qr}
        alt={`QR kartu ${name}`}
        className="border-line size-60 rounded-[12px] border bg-white p-2"
      />
      <a
        href={qr}
        download={`qr-${username}.png`}
        className="text-brand-text inline-flex min-h-11 items-center gap-2 text-base font-semibold"
      >
        <Download className="size-5" aria-hidden /> Unduh QR (PNG)
      </a>
    </div>
  );
}
