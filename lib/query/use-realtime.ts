"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";
import { reconnectStep } from "@/lib/query/realtime-status";
import { createClient } from "@/lib/supabase/client";

export type RealtimeListener = {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  table: string;
  /** Filter PostgREST, mis. `team_id=eq.<id>`. */
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

/**
 * Satu kanal Realtime untuk `postgres_changes`. Realtime hanya PEMBERITAHUAN: isi `onEvent` biasanya cukup
 * `queryClient.invalidateQueries(...)`; sumber kebenaran tetap hasil RPC. Bila kanal putus lalu tersambung ulang,
 * seluruh query aktif diambil ulang (notifikasi yang terlewat tidak boleh dipercaya).
 *
 * `enabled: false` (mis. pratinjau tanpa data langsung) tidak membuat kanal.
 * `listeners` boleh dibuat ulang tiap render: kanal hanya dibuat ulang saat `name` atau bentuk daftarnya
 * (event/table/filter) berubah, dan `onEvent` terbaru selalu yang dipakai.
 */
export function useRealtime(name: string, listeners: RealtimeListener[], enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const latest = useRef(listeners);
  useEffect(() => {
    latest.current = listeners;
  });
  const shape = JSON.stringify(listeners.map(({ event, table, filter }) => [event, table, filter ?? null]));

  useEffect(() => {
    if (!enabled) return;
    let channel = supabase.channel(name);
    latest.current.forEach((l, i) => {
      // Satu `.on` per pendengar; dispatch lewat ref supaya selalu memakai `onEvent` terbaru. Tipe `event` di
      // supabase-js berupa overload per huruf, jadi gabungan event dikirim lewat bentuk "*" (perilaku runtime sama).
      channel = channel.on(
        "postgres_changes",
        {
          event: l.event as "*",
          schema: "public",
          table: l.table,
          ...(l.filter ? { filter: l.filter } : {}),
        },
        (payload) =>
          latest.current[i]?.onEvent(payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      );
    });
    let dropped = false;
    channel.subscribe((status) => {
      const step = reconnectStep(status, dropped);
      dropped = step.dropped;
      if (step.reconnected) void queryClient.invalidateQueries();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, name, shape, enabled]);
}
