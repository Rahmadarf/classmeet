# Classmeet Market — Dokumentasi Proyek

Web simulasi bursa saham + game pos untuk lomba classmeet. Tim **mulai dari Rp 0**, bermain di pos fisik, lalu menunjukkan QR timnya ke penjaga. Penjaga memindai kartu dan mengirim hadiah, **uangnya langsung masuk saldo (tanpa ACC)**. Tim **tidak membawa ponsel**: mereka membawa **kartu QR** yang dipindai penjaga (hadiah) dan dipindai di **laptop trading** panitia (masuk akun, keluar otomatis 5 menit). Uang diputar di pasar saham fiktif (25 aset) yang harganya digerakkan **berita yang dipilih sistem secara acak berbatas** dari ±100 berita: berita tampil, **15 menit kemudian** harga 4–7 aset berubah, lalu jeda 5 menit sebelum berita berikutnya. Game berjalan 3 hari; admin membuka/menutup pasar dengan tombol (08.00–19.00). Pemenang ditentukan lewat net worth; leaderboard hanya tampil di **layar ruang publik**.

> Status: **perencanaan** (belum ada kode aplikasi). Skema dan fungsi database sudah dijalankan dan diuji di PostgreSQL lokal ([`10-verification-report.md`](10-verification-report.md)), tetapi belum di Supabase sungguhan. Bagian yang masih butuh keputusan panitia ada di [`01-overview.md`](01-overview.md#9-keputusan-yang-masih-terbuka).
>
> **Revisi 4** (terbaru, 16 Nov; ada folder [`scripts/`](scripts/) berisi pemeriksa dan pengimpor berita + contoh data): UI mengikuti layout IT FEST (doc 07 §0); net worth dan peringkat memakai **harga beli**; layar publik 5 kartu tim; tombol Beli tidak pernah nonaktif (penolakan saat Konfirmasi), Jual hanya di Portofolio; penjaga tanpa kode cadangan, riwayat, dan daftar hadiah, pos dibuka/ditutup dengan toggle; halaman berita admin hanya tampilan; panel status diringkas.
>
> **Revisi 3**: tim tanpa ponsel + login kartu QR di laptop, game 3 hari, pasar dibuka/ditutup admin, 25 aset, biaya jual 5 %, berita acak berbatas dari kumpulan siap, tombol Tersedia pos + daftar pos, hosting Docker di server sekolah + Cloudflare Tunnel ([`11-deployment.md`](11-deployment.md)). Teruji: 352 pemeriksaan SQL lulus. **Sistem ACC dihapus**: hadiah pos langsung masuk saldo, tanpa batas nominal atau pengaman pengganti (keputusan 13 Nov). **Belum diuji**: kode aplikasi, login kartu QR, Docker Supabase, `pg_cron` di image self-hosted.
>
> Revisi 7 (17 Nov): berita dipilih dan dijadwalkan sepenuhnya oleh **sistem**; jeda perubahan harga acak 3–15 menit; panitia tidak bisa mengubah harga, berita, atau parameternya sejak game dibuka (penguncian database, [05](05-game-rules.md) §4.1a). Menggantikan aturan "efek 15 menit / jeda 5 menit / antrean admin" di revisi 2.
>
> Revisi 8 (17 Nov): trading diganti **order book** (bandar panitia + order antar-tim, limit/market, partial fill, biaya 0,25 % per sisi, peringkat memakai harga peringkat VWAP 10 menit). SQL, RPC, dan tes sudah ada ([12](12-order-book.md), [04](04-rpc-contracts.md) §3.1); `buy_item`, `sell_item`, dan tabel `transactions` dihapus. UI masih desain Figma. Risiko tersisa: dua tim yang rela berdagang ≥ 5 lot per 10 menit masih bisa menggeser peringkat (dibatasi ARA/ARB).
>
> Revisi 2: harga **tidak lagi acak**; hanya berubah lewat berita yang dipilih admin (efek 15 menit setelah tayang, jeda 5 menit, antrean otomatis); tanpa batas pegang per tim (dihapus 16 Nov); stok ditetapkan di awal; dashboard tim hanya tiga angka; game diakhiri manual; folder `app/` tanpa `src/`. Sebelumnya (revisi 1): modal Rp 0, tanpa batas kunjungan, leaderboard hanya di ruang publik, hadiah lewat QR → pengajuan → ACC admin.
>
> **Menyusul dari panitia:** daftar pos nyata + rentang hadiah, bahan ±100 berita (teks, pengecoh, kunci jawaban), konfirmasi profil 25 aset, jumlah laptop trading, rencana internet cadangan.

## Daftar dokumen

| # | File | Isi | Dibaca oleh |
|---|------|-----|-------------|
| 1 | [`01-overview.md`](01-overview.md) | Tujuan, ruang lingkup, peran pengguna, istilah, observasi platform acuan | Semua |
| 2 | [`02-architecture.md`](02-architecture.md) | Stack, komponen, alur data, realtime, struktur repo | Developer |
| 3 | [`03-database.md`](03-database.md) | Skema tabel, ERD, indeks, constraint, RLS | Developer |
| 4 | [`04-rpc-contracts.md`](04-rpc-contracts.md) | Fungsi database (beli, jual, QR, hadiah langsung, siklus berita, admin), error code | Developer |
| 5 | [`05-game-rules.md`](05-game-rules.md) | Aturan lomba: trading, pos, berita, harga, penilaian | Panitia + developer |
| 6 | [`06-security.md`](06-security.md) | Autentikasi, otorisasi, idempotensi, ancaman dan mitigasi | Developer |
| 7 | [`07-ui-ux.md`](07-ui-ux.md) | Halaman per peran, alur, state UI, aksesibilitas | Developer + desainer |
| 7b | [`DESIGN.md`](DESIGN.md) | Mode light (halaman biru pucat, kartu putih, sidebar putih, tombol utama biru royal) + aksen maskot, tanpa latar hitam, tipografi, rupa komponen sesuai Figma, kontras terhitung | Desainer + developer |
| 12 | [`12-order-book.md`](12-order-book.md) | **Mekanisme trading order book** (bandar + antar-tim, limit/market, ARA/ARB, biaya 0,25 %, halaman UI). Sudah diimplementasikan dan diuji; menggantikan §3 di 05 |
| 8 | [`08-operations.md`](08-operations.md) | Setup, deployment, backup, runbook hari-H, rencana darurat | Panitia + developer |
| 9 | [`09-roadmap-and-testing.md`](09-roadmap-and-testing.md) | Urutan pengerjaan, strategi uji, risiko | Developer |
| 10 | [`10-verification-report.md`](10-verification-report.md) | Hasil menjalankan rancangan SQL di PostgreSQL sungguhan, bug yang ditemukan, yang belum diuji | Developer |
| 11 | [`11-deployment.md`](11-deployment.md) | Docker Supabase self-hosted, Next.js, Cloudflare Tunnel, cadangan, uji asap (belum dicoba) | Developer |
| – | [`tests/`](tests/) | Skrip uji (Python + psycopg2) yang menghasilkan laporan di atas | Developer |

## Ringkasan keputusan arsitektur

- **Frontend + server:** Next.js (App Router, TypeScript, Tailwind).
- **Data + auth + realtime:** Supabase (PostgreSQL, Supabase Auth, Supabase Realtime).
- **Tanpa Redis.** Skala di bawah 20 tim tidak membutuhkannya, dan kebenaran transaksi dijamin oleh PostgreSQL.
- **Semua perubahan uang dan stok lewat fungsi database (RPC) atomik.** Klien tidak pernah menulis langsung ke tabel sensitif.
- **Idempotensi** di setiap aksi yang mengubah saldo, supaya tombol yang ditekan dua kali tidak mencatat dua kali.
- **Empat peran:** `admin` (panitia), `guard` (penjaga pos), `team` (peserta), `display` (layar ruang publik).
- **Hadiah pos langsung masuk saldo:** penjaga memindai kartu QR tim dan mengirim nominal; tanpa ACC, tanpa batas nominal. Koreksi hanya oleh admin sesudahnya (`admin_adjust_cash`).
- **Harga digerakkan berita:** sistem memilih acak dari kumpulan berita siap, membuang calon yang membuat harga menabrak batas; waktu perubahan acak 3–15 menit diundi sistem, satu berita aktif sekali waktu, harga terkunci sejak game dibuka. Dijalankan `pg_cron` di database; tidak ada pergerakan acak.
- **Login tim:** kartu QR (akun + rahasia) dipindai di laptop panitia; tanpa PIN; keluar otomatis 5 menit.
- **Tanpa batas pegang** per tim (dihapus 16 Nov); pembatasnya hanya stok (ditetapkan di awal game) dan saldo.

## Skala target

- Kurang dari 20 tim, 10–12 pos, 4 peran.
- Beban puncak kecil (puluhan koneksi bersamaan). Risiko utama adalah **kebenaran data dan keandalan hari-H**, bukan performa.

## Konvensi dokumen

- Uang disimpan sebagai **bilangan bulat rupiah** (`bigint`), tidak pernah desimal.
- Waktu disimpan sebagai `timestamptz` (UTC) dan ditampilkan dalam WIB (Asia/Jakarta).
- Nama tabel, kolom, dan fungsi memakai `snake_case` Inggris. Teks untuk pengguna memakai Bahasa Indonesia.
- Blok SQL di dokumen ini adalah **rancangan acuan**, bukan migrasi final. Jalankan dan uji dulu di project Supabase terpisah.
