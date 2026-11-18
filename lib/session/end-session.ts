import { getKioskDevice } from "@/lib/kiosk/device";
import { createClient } from "@/lib/supabase/client";

export type EndReason = "logout" | "idle_logout";

let ending = false;

/**
 * Akhiri sesi tim di laptop trading: catat ke audit (`log_kiosk_event`), cabut token (signOut global),
 * lalu kembali ke /kiosk dengan muat ulang penuh supaya tidak ada state tim sebelumnya yang tersisa.
 * Dipanggil oleh tombol Selesai (`logout`) dan timer 5 menit (`idle_logout`). Aman dipanggil berulang.
 */
export async function endSession(reason: EndReason): Promise<void> {
  if (ending) return;
  ending = true;
  const supabase = createClient();
  try {
    // Catat dulu selagi token masih berlaku. Gagal mencatat tidak boleh menahan keluar.
    await supabase.rpc("log_kiosk_event", { p_event: reason, p_device: getKioskDevice() });
  } catch {
    // diabaikan
  }
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // jaringan putus: cookie lokal tetap dihapus oleh /kiosk saat dibuka
    }
  }
  // Muat ulang penuh disengaja: tidak boleh ada state/cache tim sebelumnya yang tersisa di laptop.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/kiosk";
}
