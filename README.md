# Classmeet Market — Dokumentasi Proyek

Web simulasi bursa saham + game pos untuk lomba classmeet. Tim **mulai dari Rp 0**, bermain di pos fisik, lalu menunjukkan QR timnya ke penjaga. Penjaga mengajukan hadiah, **admin menyetujui (ACC)**, dan baru uangnya masuk. Uang itu diputar di pasar saham fiktif yang harganya digerakkan **berita pilihan admin**: berita tampil, **15 menit kemudian** harga 4–7 aset berubah, lalu jeda 5 menit sebelum berita berikutnya. Pemenang ditentukan lewat net worth; leaderboard hanya tampil di **layar ruang publik**.

> Status: **perencanaan** (belum ada kode aplikasi). Skema dan fungsi database sudah dijalankan dan diuji di PostgreSQL lokal ([`10-verification-report.md`](10-verification-report.md)), tetapi belum di Supabase sungguhan. Bagian yang masih butuh keputusan panitia ada di [`01-overview.md`](01-overview.md#9-keputusan-yang-masih-terbuka).
>
> Revisi aturan terakhir (revisi 2): harga **tidak lagi acak**; hanya berubah lewat berita yang dipilih admin (efek 15 menit setelah tayang, jeda 5 menit, antrean otomatis); batas pegang kumulatif 7–10 per aset; stok ditetapkan di awal; dashboard tim hanya tiga angka; game diakhiri manual; folder `app/` tanpa `src/`. Sebelumnya (revisi 1): modal Rp 0, tanpa batas kunjungan, leaderboard hanya di ruang publik, hadiah lewat QR → pengajuan → ACC admin.
>
> **Menyusul dari panitia:** daftar aset beserta profil/sifatnya, dan bahan berita (teks, pengecoh, kunci jawaban).

## Daftar dokumen

| # | File | Isi | Dibaca oleh |
|---|------|-----|-------------|
| 1 | [`01-overview.md`](01-overview.md) | Tujuan, ruang lingkup, peran pengguna, istilah, observasi platform acuan | Semua |
| 2 | [`02-architecture.md`](02-architecture.md) | Stack, komponen, alur data, realtime, struktur repo | Developer |
| 3 | [`03-database.md`](03-database.md) | Skema tabel, ERD, indeks, constraint, RLS | Developer |
| 4 | [`04-rpc-contracts.md`](04-rpc-contracts.md) | Fungsi database (beli, jual, QR, pengajuan + ACC hadiah, siklus berita, admin), error code | Developer |
| 5 | [`05-game-rules.md`](05-game-rules.md) | Aturan lomba: trading, pos, berita, harga, penilaian | Panitia + developer |
| 6 | [`06-security.md`](06-security.md) | Autentikasi, otorisasi, idempotensi, ancaman dan mitigasi | Developer |
| 7 | [`07-ui-ux.md`](07-ui-ux.md) | Halaman per peran, alur, state UI, aksesibilitas | Developer + desainer |
| 8 | [`08-operations.md`](08-operations.md) | Setup, deployment, backup, runbook hari-H, rencana darurat | Panitia + developer |
| 9 | [`09-roadmap-and-testing.md`](09-roadmap-and-testing.md) | Urutan pengerjaan, strategi uji, risiko | Developer |
| 10 | [`10-verification-report.md`](10-verification-report.md) | Hasil menjalankan rancangan SQL di PostgreSQL sungguhan, bug yang ditemukan, yang belum diuji | Developer |
| – | [`tests/`](tests/) | Skrip uji (Python + psycopg2) yang menghasilkan laporan di atas | Developer |

## Ringkasan keputusan arsitektur

- **Frontend + server:** Next.js (App Router, TypeScript, Tailwind).
- **Data + auth + realtime:** Supabase (PostgreSQL, Supabase Auth, Supabase Realtime).
- **Tanpa Redis.** Skala di bawah 20 tim tidak membutuhkannya, dan kebenaran transaksi dijamin oleh PostgreSQL.
- **Semua perubahan uang dan stok lewat fungsi database (RPC) atomik.** Klien tidak pernah menulis langsung ke tabel sensitif.
- **Idempotensi** di setiap aksi yang mengubah saldo, supaya tombol yang ditekan dua kali tidak mencatat dua kali.
- **Empat peran:** `admin` (panitia; dibagi tugas: berita dan ACC), `guard` (penjaga pos), `team` (peserta), `display` (layar ruang publik).
- **Hadiah pos tidak langsung masuk:** penjaga memindai QR tim dan mengajukan nominal; saldo hanya berubah setelah admin menekan ACC.
- **Harga digerakkan berita pilihan admin:** efek diterapkan 15 menit setelah berita tayang, jeda 5 menit, satu berita aktif sekali waktu, berita berikutnya bisa diantre. Dijalankan `pg_cron` di database; tidak ada pergerakan acak.
- **Batas pegang kumulatif** 7–10 unit per tim per aset; stok ditetapkan di awal game.

## Skala target

- Kurang dari 20 tim, 10–12 pos, 4 peran.
- Beban puncak kecil (puluhan koneksi bersamaan). Risiko utama adalah **kebenaran data dan keandalan hari-H**, bukan performa.

## Konvensi dokumen

- Uang disimpan sebagai **bilangan bulat rupiah** (`bigint`), tidak pernah desimal.
- Waktu disimpan sebagai `timestamptz` (UTC) dan ditampilkan dalam WIB (Asia/Jakarta).
- Nama tabel, kolom, dan fungsi memakai `snake_case` Inggris. Teks untuk pengguna memakai Bahasa Indonesia.
- Blok SQL di dokumen ini adalah **rancangan acuan**, bukan migrasi final. Jalankan dan uji dulu di project Supabase terpisah.
