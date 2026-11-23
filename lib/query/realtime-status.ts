/**
 * Status kanal Realtime → apakah kanal pernah putus dan baru tersambung ulang. Realtime hanya pemberitahuan:
 * setelah tersambung ulang, notifikasi yang terlewat tidak boleh dipercaya, jadi data diambil ulang.
 */
export function reconnectStep(status: string, dropped: boolean): { dropped: boolean; reconnected: boolean } {
  if (status === "SUBSCRIBED") return { dropped: false, reconnected: dropped };
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    return { dropped: true, reconnected: false };
  }
  return { dropped, reconnected: false };
}
