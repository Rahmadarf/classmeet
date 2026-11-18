import { Skeleton } from "@/components/states";

/** Kerangka halaman daftar admin (kepala + satu kartu besar). */
export function ListSkeleton({ title }: { title: string }) {
  return (
    <div role="status" aria-label={`Memuat ${title}`}>
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[420px]" />
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
