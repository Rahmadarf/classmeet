-- Role PIC lomba (langkah 1 dari 2): tambah nilai `pic` pada enum app_role. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/pic-role.sql
--
-- WAJIB dijalankan SEBELUM pic-lomba.sql, sebagai perintah terpisah (bukan di dalam satu transaksi dengan skrip itu):
-- nilai enum yang baru ditambahkan belum bisa dipakai di transaksi yang sama.
alter type public.app_role add value if not exists 'pic';
