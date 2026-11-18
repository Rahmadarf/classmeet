"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { setPostOpen } from "@/app/admin/posts/actions";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/chip";
import { fetchPostsPage, type AdminPost } from "@/lib/admin/data";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatRupiah } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15_000;

/**
 * Pos (Figma `Admin — Pos`, 1105:379): nomor, game, lokasi, penjaga, total hadiah, status. Chip ringkasan "N Tersedia /
 * N Tidak tersedia". Admin bisa Buka/Tutup pos lewat `admin_set_post_open` (docs/04 §3.9), dinonaktifkan saat game
 * selesai. Berubah lewat Realtime `posts`.
 */
export function PostsBoard({ initial, finished }: { initial: AdminPost[]; finished: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const dropped = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchPostsPage(supabase);
    if (next) setPosts(next);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    const channel = supabase
      .channel("admin-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payouts" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refresh();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const toggle = async (p: AdminPost) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const res = await setPostOpen({ postId: p.id, open: !p.open });
      if (res.ok) toast.success(`${p.title} ${p.open ? "ditutup" : "dibuka"}.`);
      else toast.error(res.message);
      void refresh();
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusyId(null);
    }
  };

  const open = posts.filter((p) => p.open).length;

  return (
    <>
      <PageHeader
        eyebrow="Stasiun aktivitas"
        title="Pos"
        subtitle="Penjaga, total hadiah, dan status tiap pos."
        actions={
          <>
            <StatusPill tone="ok">{open} Tersedia</StatusPill>
            <StatusPill tone="bad">{posts.length - open} Tidak tersedia</StatusPill>
          </>
        }
      />
      <Card aria-labelledby="pos-judul" className="flex flex-col gap-2">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Ketersediaan saat ini
        </p>
        <h2 id="pos-judul" className="text-ink text-2xl font-bold">
          {posts.length} pos
        </h2>
        <DataTable
          caption="Daftar pos"
          head={["No", "Game", "Lokasi", "Penjaga", "Total hadiah", "Status", ""]}
          widths={[80, 230, 220, 170, 180, 130]}
          minWidth={940}
        >
          {posts.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="rounded-control bg-tint text-ink grid h-9 w-11 place-items-center text-base font-bold">
                  {p.number ?? "–"}
                </span>
              </td>
              <td className="text-ink text-base font-semibold">{p.title}</td>
              <td>{p.location}</td>
              <td>{p.guard}</td>
              <td className="money text-ink text-right font-bold">{formatRupiah(p.total)}</td>
              <td>
                <StatusPill tone={p.open ? "ok" : "bad"}>{p.open ? "Tersedia" : "Tidak tersedia"}</StatusPill>
              </td>
              <td className="text-right">
                <Button
                  variant={p.open ? "danger" : "secondary"}
                  size="sm"
                  disabled={finished || busyId !== null}
                  loading={busyId === p.id}
                  loadingText="…"
                  aria-label={`${p.open ? "Tutup" : "Buka"} ${p.title}`}
                  onClick={() => void toggle(p)}
                >
                  {p.open ? "Tutup" : "Buka"}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="text-ink-muted text-sm">
          Pos baru selalu mulai Tidak tersedia; penjaga membukanya saat siap, admin juga bisa membuka atau
          menutupnya.
          {finished ? " Game selesai: status pos tidak bisa diubah." : ""} Total hadiah mengikuti halaman
          Hadiah.
        </p>
      </Card>
    </>
  );
}
