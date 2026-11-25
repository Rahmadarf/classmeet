# 08 — Operasional

Dokumen ini membahas setup, backup, dan **rencana hari-H** untuk acara **tiga hari**. Rincian server (Docker, Supabase self-hosted, Cloudflare Tunnel) ada di [11-deployment](11-deployment.md). Risiko utama acara bukan performa, melainkan kesalahan manusia, gangguan internet sekolah, dan server yang berhenti di tengah malam.

## 1. Lingkungan

| Lingkungan | Tujuan | Database dan aplikasi |
|------------|--------|-----------------------|
| Lokal | Pengembangan | `docker compose` Supabase di laptop developer, `next dev` |
| Staging | Uji penuh dan gladi bersih | Stack Docker yang sama di server sekolah, domain uji, **data terpisah** |
| Produksi | Tiga hari acara | Stack Docker yang sama, volume data baru dan bersih, domain produksi |

Jangan memakai satu database untuk pengujian dan hari-H. Data uji tidak boleh bercampur dengan data acara.

## 2. Setup awal

Langkah server (Docker, kunci, tunnel) ada di [11-deployment](11-deployment.md). Setelah stack berjalan:

1. Jalankan migrasi `supabase/migrations/*.sql` berurutan, lalu `seed.sql`.
2. Pastikan pendaftaran publik dimatikan dan konfirmasi email dimatikan (variabel GoTrue; lihat 11).
3. Pastikan tabel Realtime terdaftar: `assets`, `news_feed`, `game_settings`, `payouts`, `posts` (sudah ada di migrasi).
4. Aktifkan dan jadwalkan siklus berita dengan `pg_cron`: `select cron.schedule('news-cycle', '10 seconds', $$select public.process_news_cycle()$$);` dan `select cron.schedule('market-cycle', '10 seconds', $$select public.process_market_cycle()$$);` (jadwal detik butuh `pg_cron` 1.5 ke atas). Verifikasi di `cron.job_run_details` bahwa job berjalan tiap 10 detik tanpa error. Siklus hanya bergerak saat status `open`.
5. Jalankan `scripts/create-accounts.ts` (service role, hanya di laptop panitia) untuk membuat akun admin (≥ 3), penjaga, tim, dan satu akun `display`. Kata sandi akun tim diisi sama dengan `qr_token`.
6. Jalankan `scripts/print-qr.ts` untuk mencetak kartu tim: QR (memuat nama akun + rahasia), dan nama tim (tanpa kode cadangan).
7. Tulis kumpulan berita (±100) di `news.json` (format di `scripts/news.example.json`: `judul`, `isi`, `efek` berisi `simbol` dan `persen`). Jalankan `node --experimental-strip-types scripts/import-news.ts check news.json assets.json` (offline): ia memeriksa aturan dan mensimulasikan apakah kumpulan cukup dan tidak macet di batas harga. Perbaiki sampai tidak ada peringatan, lalu `import news.json` (latihan) dan `import news.json --apply --ready` (menyimpan dan menandai siap). Aman dijalankan ulang: berita dengan judul yang sudah ada dilewati.
8. Buat satu akun uji per peran dan masuk ke masing-masing. Untuk tim uji, masuk dengan memindai kartu di laptop trading.

### Skrip `create-accounts.ts`

Masukan: file CSV berisi `username, display_name, role, team_name | post_name | post_location`.
Keluaran:
- Akun di Supabase Auth + baris `profiles`, `teams` (saldo **0**, `qr_token` otomatis, `short_code` acak 6 karakter tanpa `0/O/1/I`), `posts`.
- Satu akun `display` (role `display`) untuk layar ruang publik.
- File **kartu akses** (CSV) berisi username dan password acak. File ini **jangan di-commit** dan dihapus setelah kartu dicetak. Password admin dan `display` tidak masuk kartu tim.

### Skrip `print-qr.ts`

Membaca `teams.qr_token` (service role, lokal) lalu menghasilkan lembar cetak per tim: nama tim dan QR besar. Tim tidak membawa ponsel, jadi kartu cetak adalah satu-satunya QR yang ada. Cetak **dua set**: satu dibagikan ke tim, satu (dilaminasi) disimpan panitia sebagai cadangan bila kartu hilang. Kartu yang hilang diganti dengan `scripts/rotate-team-qr.ts` (mengubah `qr_token` dan kata sandi akun sekaligus), lalu cetak ulang.

## 3. Deployment

Ringkasan; langkah lengkap di [11-deployment](11-deployment.md).

- Aplikasi Next.js dan Supabase self-hosted berjalan di Docker pada server guru di sekolah; Cloudflare Tunnel menyalurkan domain ke server. Tidak ada Vercel.
- Variabel lingkungan aplikasi: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Jangan** masukkan service role key ke container aplikasi.
- Siklus berita berjalan di database (`pg_cron`), bukan di server web.
- **Bekukan kode** (code freeze) minimal H-3. Setelah itu hanya perbaikan bug kritis.
- Uji dari laptop trading sungguhan melalui domain produksi (HTTPS) **dan** dari ponsel penjaga lewat jaringan seluler dan Wi-Fi sekolah.

## 4. Backup dan pemulihan

Server tunggal di sekolah tidak punya cadangan otomatis. Anggap data bisa hilang kapan saja dan buat cadangan sendiri, **disimpan di luar server itu**.

| Kapan | Apa | Cara |
|-------|-----|------|
| Sebelum pasar dibuka (hari 1) | Snapshot kondisi awal | `pg_dump` |
| Tiap hari, saat pasar ditutup | Snapshot akhir hari | `pg_dump` + salin ke laptop panitia |
| Saat pasar buka, tiap 30 menit | Cadangan berkala | Tugas terjadwal di server (cron host); simpan di folder bertanggal |
| Setelah `finished` | Snapshot final + ekspor CSV | `pg_dump` + `scripts/export-results.ts` |

Contoh perintah (dari host, ke container database):

```bash
docker exec supabase-db pg_dump -U postgres -d postgres --no-owner --format=custom \
  > "backup-$(date +%Y%m%d-%H%M).dump"
```

Pemulihan: jalankan stack baru dari `docker compose`, `pg_restore` ke database-nya, lalu arahkan tunnel ke stack itu. **Latih sekali di staging** sebelum hari-H; pemulihan yang belum pernah dicoba tidak bisa diandalkan.

Catatan tiga hari: volume data harus **volume bernama** (bukan folder sementara), `restart: unless-stopped` pada semua layanan, dan server tidak boleh tidur atau mati otomatis. Periksa sebelum hari 1 dan setiap pagi.

## 5. Pemantauan

- **Halaman kesehatan** `/api/health`: memeriksa koneksi ke database dan mengembalikan status. Dibuka lewat domain produksi dari ponsel sebelum acara dan tiap pagi.
- Log container (`docker compose logs`) dan log Cloudflare Tunnel dibuka di satu layar teknis saat acara.
- Panel admin menampilkan jumlah transaksi per menit dan waktu transaksi terakhir; lonjakan atau keheningan mencurigakan menandakan masalah.
- **Hadiah:** halaman Hadiah admin menampilkan hadiah terbaru dan total per pos. Periksa sesekali nominal yang janggal (⚠ jauh di atas rata-rata pos); tidak ada antrean persetujuan, jadi tidak ada yang menahan tim.
- **Kumpulan berita:** panel status menampilkan jumlah berita *siap*, *boleh terbit sekarang*, dan *terpakai* (`get_news_pool_status`). Peringatan merah bila *siap* = 0 atau *boleh terbit* = 0 saat pasar buka: pasar akan diam. Di hari biasa kira-kira 33 berita terpakai per hari.
- **Siklus berita:** admin **tidak** melihat hitung mundur maupun isi kumpulan berita sesudah game dibuka; panel status hanya menampilkan jumlah. Tanda siklus macet: berita yang sedang tayang di layar publik sudah lebih dari **16 menit** (batas atas 15 menit + 10 detik penjadwal) tetapi harga belum berubah, atau tidak ada berita baru padahal kumpulan masih berisi. Periksa `cron.job_run_details` dan log database di server. Tidak ada tombol di aplikasi; pemulihan dilakukan di server (jalankan ulang `pg_cron`, atau panggil `select process_news_cycle()` oleh petugas server, yang hanya menjalankan mekanisme sistem dan tidak memilih berita).
- **Laptop trading:** tiap laptop punya nama (mis. `laptop-3`) yang dikirim ke `log_kiosk_event`. Nama laptop tidak tampil di layar `/kiosk`; panel audit menampilkan siapa memakai laptop mana dan kapan. Laptop yang tidak bisa memindai QR atau yang sesinya macet dicatat dan diganti.

## 6. Uji beban dan gladi

Sebelum hari-H, jalankan di **staging**:

1. **Uji konkurensi stok:** 30 pembelian paralel pada aset berstok 5. Hasil yang benar: tepat 5 sukses, 25 `out_of_stock`, stok akhir 0.
2. **Uji idempotensi:** `request_id` sama dikirim 20 kali paralel (beli dan beri hadiah). Hasil yang benar: satu transaksi / satu hadiah, saldo berubah sekali.
3. **Uji hadiah:** penjaga memberi hadiah ke tim uji; saldo tim harus langsung naik sebesar nominal, dan setelah `Akhiri game` hadiah ditolak.
4. **Uji siklus berita:** di staging setel `news_delay_min_minutes = 1`, `news_delay_max_minutes = 2`, dan `news_gap_minutes = 0` **sebelum membuka game**, tandai lima berita *siap*, buka pasar, dan pastikan: salah satu tayang sendiri, harga berubah antara 1 dan 2 menit kemudian dengan jeda yang **berbeda-beda** antarberita, berita berikutnya terpilih sendiri, tidak ada yang terbit dua kali, `price_history` berisi baris `berita`, dan harga tetap dalam batas. Tutup pasar di tengah: tenggat harus ikut tertunda. **Uji penguncian:** setelah dibuka, coba ubah harga aset, tambah berita, dan ubah parameter berita lewat akun admin; semuanya harus ditolak `game_started_locked`, dan admin tidak bisa membaca tabel `news`. Pengaturan uji ini hanya untuk staging; di produksi nilainya 3 dan 15.
   - Uji pemilih berbatas: siapkan satu berita yang akan membuat harga menabrak batas; hasil yang benar adalah ia tidak pernah terpilih sampai harga bergeser.
   - Uji juga stok: beberapa laptop membeli aset berstok tipis sekaligus; hasil yang benar adalah stok tidak pernah negatif.
5. **Uji pindai QR:** semua kartu QR tim dipindai (a) oleh akun penjaga di ponsel, di bawah cahaya terang dan redup, dan (b) di setiap laptop trading untuk masuk. Catat laptop yang kameranya bermasalah.
6. **Uji sesi laptop trading:** masuk sebagai tim A, biarkan 5 menit (harus keluar sendiri); masuk lalu tutup tab tanpa keluar, buka `/kiosk`, dan pastikan sesi tim A tidak terbawa; masuk tim B tepat setelah tim A menekan Selesai.
7. **Uji beban ringan:** laptop trading yang akan dipakai (semua sekaligus) + 12 penjaga + 3 admin + 1 layar publik bersamaan selama 10 menit dengan skrip yang meniru perilaku nyata.
8. **Uji ketahanan server:** matikan dan nyalakan ulang server (atau cabut jaringan 2 menit). Pastikan semua kontainer hidup lagi sendiri, data utuh, tunnel tersambung, dan `pg_cron` melanjutkan siklus.
9. **Gladi bersih** (*dress rehearsal*) dengan panitia dan beberapa relawan sebagai tim di laptop trading dan penjaga di ponsel, memakai domain produksi, menjalankan satu hari yang dipercepat.

## 7. Daftar periksa waktu

### H-7 sampai H-3
- [ ] Semua fitur versi 1 selesai di staging.
- [ ] Gladi bersih pertama selesai, temuan dicatat.
- [ ] Latihan pemulihan cadangan di staging berhasil.
- [ ] Uji ketahanan server (restart, jaringan putus) lulus.
- [ ] Panitia menentukan semua parameter di [01-overview](01-overview.md#9-keputusan-yang-masih-terbuka).

### H-2 sampai H-1
- [ ] Stack produksi berjalan dengan kunci baru (bukan kunci contoh Supabase); Studio tidak terbuka ke internet.
- [ ] Akun admin, penjaga, dan tim dibuat. Kartu QR dicetak dua set.
- [ ] ±100 berita dimasukkan, diperiksa, dan ditandai *siap*; jumlah *boleh terbit* ≥ 30 pada awal hari 1.
- [ ] Semua penjaga login sekali dan mengetes pindai + kirim hadiah dengan tim uji, lalu **data uji dikoreksi** (saldo tim kembali ke **Rp 0** lewat `admin_adjust_cash` negatif, atau pakai akun tim uji khusus yang dihapus setelahnya). Hadiah uji **langsung** mengubah saldo, jadi jangan sampai tim sungguhan ikut terisi. Lebih aman: buat akun tim uji khusus dan hapus setelahnya.
- [ ] Setiap kartu QR tim berhasil dipindai oleh akun penjaga **dan** berhasil masuk di minimal satu laptop trading.
- [ ] PIC lomba (hari 1 dan 3) dan penjaga rally (hari 2) diberi briefing dan PIN masing-masing (`PIC_PIN` dan `GUARD_PIN` berbeda); `PIC_PIN` sudah diubah di `.env.local` dari bawaan 54321.
- [ ] Admin sudah mencoba `admin_adjust_cash` negatif untuk membatalkan hadiah uji, dan semua penjaga diberi briefing: **nominal langsung masuk, periksa dua kali sebelum menekan kirim**.
- [ ] Layar publik sudah login sebagai `display`, menampilkan berita dan leaderboard, dan terbaca dari jarak terjauh penonton.
- [ ] Cadangan awal dibuat dan salinannya ada di luar server.
- [ ] Pemeriksaan keamanan di [06-security](06-security.md#9-daftar-periksa-sebelum-rilis) lulus.

### Setiap pagi (hari 1, 2, 3)
- [ ] Server menyala, semua kontainer sehat, `/api/health` hijau lewat domain produksi.
- [ ] Cadangan semalam ada; jumlah berita *siap* dan *boleh terbit* cukup untuk hari ini (sekitar 33).
- [ ] Laptop trading menyala, terhubung, dan kameranya diuji dengan satu kartu uji.
- [ ] Penjaga sudah di pos, login, dan membuka tombol **Tersedia** pos masing-masing saat siap.
- [ ] Admin pasar menekan **Buka pasar** pada jam 08.00 (hari 1: `setup → open`).

### Selama acara
- [ ] Satu admin memantau halaman Hadiah secara berkala untuk nominal janggal.
- [ ] Admin pasar memantau panel kumpulan berita; tidak perlu memilih berita karena sistem memilih sendiri. Tulis berita tambahan bila *siap* menipis.
- [ ] Cadangan tiap 30 menit.
- [ ] Satu orang khusus memegang "meja bantuan" untuk keluhan tim dan laptop trading yang bermasalah; satu petugas berjaga di area laptop trading (antrean, kartu hilang, sesi macet).
- [ ] Jam 19.00: tekan **Tutup pasar** (jeda). Pos menutup (penjaga menekan Tidak tersedia); cadangan akhir hari dibuat dan disalin ke luar server.
- [ ] Hari 3, 15 menit sebelum akhir: bekukan leaderboard.
- [ ] Hari 3, beberapa menit sebelum akhir: umumkan "pos tutup".
- [ ] Hari 3: tutup pasar, tunggu berita yang sedang tayang selesai (paling lama 15 menit), lalu tekan **Selesai**. Bila masih ada berita live, database menolak (`news_pending`); tunggu, tidak ada jalan pintas.
- [ ] **Sebelum membuka game pertama kali:** kumpulan berita sudah **±220 siap** dan sudah diperiksa, aset dan harga awal final, `news_gap_minutes` sudah dipilih. Sesudah dibuka semuanya terkunci dan tidak bisa diperbaiki.
- [ ] Kunci `service_role` dan kata sandi pemilik database dipegang satu orang non-panitia atau disegel selama acara; tidak ada yang membuka konsol database di tengah game.

### Setelah acara
- [ ] Cadangan final dan ekspor CSV hasil akhir disimpan di dua tempat.
- [ ] Hasil diumumkan setelah panitia memeriksa audit.
- [ ] Setelah masa keberatan: hapus akun peserta, rotasi semua kunci, matikan tunnel, arsipkan atau hapus data.

## 8. Rencana darurat

| Masalah | Tindakan |
|---------|----------|
| Kartu QR tim hilang | Admin menjalankan `scripts/rotate-team-qr.ts` untuk tim itu (mengganti token dan kata sandi), cetak kartu baru. Kartu lama berhenti berfungsi seketika |
| Kamera laptop tidak membaca QR | Coba cahaya lebih terang dan jarak berbeda; pindah ke laptop lain. Kamera penjaga yang gagal berarti ganti perangkat penjaga; tidak ada jalur kode cadangan di UI |
| Sesi tim tertinggal di laptop | Halaman `/kiosk` otomatis keluar; bila macet, tutup tab dan buka lagi. Cek `audit_log` atas nama tim yang mengeluh |
| Transaksi aneh atau harga salah | **Tutup pasar dulu**, baru selidiki lewat `audit_log`, `orders`, dan `trades`. Harga **tidak bisa dikoreksi** (dikunci); koreksi saldo dengan `admin_adjust_cash` dengan alasan tertulis |
| Penjaga salah memasukkan nominal | Tidak ada ACC, jadi saldo sudah berubah. Admin mengoreksi dengan `admin_adjust_cash` (selisih negatif, alasan wajib) |
| Penjaga curang atau berkolusi | Terlihat dari halaman Hadiah (`payouts`). Tutup pos itu, koreksi saldo dengan `admin_adjust_cash`, putuskan sebagai panitia. Tidak ada pencegahan di muka |
| Pasar diam: berita habis atau semua calon berbahaya | Tulis dan tandai berita baru *siap*; atau koreksi harga manual agar calon tidak lagi menabrak batas; sistem melanjutkan sendiri |
| Harga tidak berubah padahal berita tayang sudah lebih dari 16 menit | Cek `cron.job_run_details` dan log database; perbaiki penjadwal di server. Tidak ada tombol di aplikasi |
| Efek terlalu liar / terlalu kecil | Setelah game dibuka berita dan efek **terkunci**; tidak ada koreksi. Periksa semua berita sebelum game dibuka. Bila tetap terjadi, terima sebagai bagian permainan, atau koreksi lewat saldo dengan keputusan panitia yang dicatat |
| Berita bermasalah ditemukan setelah masuk kumpulan | Jika masih `ready`: keluarkan lewat konsol teknis (`admin_set_news_ready(false)`, kembali ke draf), perbaiki di `news.json`, dan impor ulang dengan judul baru. Jika sudah `live` tetapi harga belum berubah: tidak bisa dibatalkan satu tombol; tutup pasar dan atur harga manual setelah efek jatuh tempo. Jika efek sudah diterapkan: koreksi harga manual dan masukkan berita klarifikasi |
| Admin lupa menutup pasar di malam hari | Berita terus tayang dan harga berubah tanpa ada tim yang melihat. Saat ditemukan: tutup pasar; bila ada kerugian yang tidak adil, putuskan bersama juri; harga tidak bisa diubah, hanya saldo (`admin_adjust_cash`). Pencegahan: satu orang bertugas menutup pasar jam 19.00 (daftar periksa) |
| Layar publik mati | Login ulang akun `display`; leaderboard tetap bisa dilihat admin di panelnya |
| Internet sekolah mati | Tunnel putus sehingga **laptop trading dan ponsel penjaga tidak bisa mengakses server** walau server menyala. Pindah ke sambungan cadangan (hotspot seluler yang sudah diuji); sambil menunggu tutup pasar, penjaga mencatat hasil di kertas dan mengirim satu per satu setelah pulih (antrean lokal mengirim ulang otomatis, aman karena idempotensi); saldo tim baru naik saat hadiah benar-benar terkirim |
| Server sekolah mati atau restart | Cek listrik dan jaringan; kontainer harus hidup lagi sendiri (`restart: unless-stopped`); periksa `/api/health` dan `cron.job_run_details`. Efek berita yang jatuh tempo saat mati diterapkan terlambat begitu siklus berjalan; periksa apakah itu merugikan tim |
| Dugaan kecurangan | Tutup pasar, periksa `trades`, `orders`, dan `audit_log` (termasuk login laptop) tim terkait, putuskan sebagai panitia |
| Ada yang menekan tombol "Akhiri game" tanpa sengaja | Status `finished` tidak bisa kembali lewat UI. Siapkan prosedur darurat: dari konsol SQL (psql di container database) jalankan `delete from leaderboard_snapshot; update game_settings set state = 'paused', leaderboard_frozen_at = null;`, lalu catat kejadiannya (perubahan lewat SQL tidak tercatat otomatis di `audit_log`) |

## 9. Peran panitia

| Peran | Tugas | Jumlah |
|-------|-------|--------|
| Admin pasar | Buka/tutup pasar, memantau kumpulan berita dan menulis berita tambahan, harga manual bila perlu | 1 |
| Admin cadangan | Siaga, bisa menutup pasar dan mengoreksi | 1 |
| Teknis | Pantau server, tunnel, kesehatan, log, cadangan berkala, pagi hari memeriksa server | 1 |
| Petugas laptop trading | Menjaga area laptop (antrean, kartu hilang, kamera bermasalah, sesi macet) | 1–2 |
| Meja bantuan | Keluhan tim, penggantian kartu QR | 1 |
| Penjaga pos | Memindai QR, memberi hadiah (langsung masuk), mengatur status Tersedia pos | 10–12 |
| Operator layar publik | Menjaga layar `display` menyala dan terbaca | 1 |
| MC / juri | Pengumuman, penentuan juara | 1–2 |

Tidak ada lagi peran ACC. Pisahkan tetap peran "teknis" (server, tunnel, cadangan) dari admin pasar supaya masalah teknis tidak menahan operasional pasar.
