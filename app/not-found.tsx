import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="bg-page grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">404</p>
        <h1 className="text-ink mt-1 text-[32px] font-bold">Halaman tidak ditemukan</h1>
        <p className="text-ink-muted mt-2 text-lg">Alamat yang kamu buka tidak ada atau sudah dipindahkan.</p>
        <Link href="/" className={cn(buttonVariants({ variant: "primary" }), "mt-6")}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
