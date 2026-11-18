/**
 * Nama laptop trading (mis. `laptop-3`), diset SEKALI per perangkat dan dikirim ke `log_kiosk_event`
 * supaya admin tahu laptop mana yang dipakai. TIDAK ditampilkan di layar (docs/07 §3.3).
 *
 * Cara set: buka sekali `/kiosk?device=laptop-3` di laptop itu. Nama disimpan di localStorage perangkat
 * dan query dihapus dari URL. Nama laptop bukan rahasia.
 */
const KEY = "classmeet.kioskDevice";
const DEVICE_RE = /^[a-z0-9_-]{1,40}$/;

export function getKioskDevice(): string | undefined {
  try {
    const value = window.localStorage.getItem(KEY);
    return value && DEVICE_RE.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Baca ?device= dari URL, simpan, lalu hapus dari URL. */
export function applyDeviceFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const device = url.searchParams.get("device")?.trim().toLowerCase();
    if (device === undefined || device === null) return;
    if (DEVICE_RE.test(device)) window.localStorage.setItem(KEY, device);
    url.searchParams.delete("device");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
  } catch {
    // localStorage/URL tidak tersedia: lewati, log akan tanpa nama laptop.
  }
}
