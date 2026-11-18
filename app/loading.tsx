// Latar sama dengan halaman (DESIGN.md §7): tidak ada kilat gelap saat memuat.
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat" className="bg-page min-h-dvh p-8">
      <div className="skeleton h-8 w-64" />
      <div className="skeleton mt-6 h-40 w-full max-w-3xl" />
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
