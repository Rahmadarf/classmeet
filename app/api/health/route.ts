// Cek kesehatan sederhana (tanpa sesi, tanpa data); dipakai tunnel/monitor.
export function GET() {
  return Response.json({ ok: true });
}
