import type { Metadata } from "next";
import { KioskScanner } from "@/components/kiosk/kiosk-scanner";

export const metadata: Metadata = { title: "Masuk laptop trading" };

// Halaman tunggal tim tanpa AppShell: layar penuh, logo + pratinjau kamera (docs/07 §3.3).
export default function KioskPage() {
  return <KioskScanner />;
}
