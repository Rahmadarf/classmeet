# 01 — Ringkasan Proyek

## 1. Tujuan

Membangun web untuk lomba classmeet yang menggabungkan dua hal:

1. **Game pos offline.** Tim berkeliling pos fisik, memainkan game, dan mendapat uang virtual dari penjaga pos.
2. **Simulasi bursa.** Tim membeli dan menjual aset (perusahaan asli, harga rekaan). Harga digerakkan oleh berita yang dipilih **otomatis** oleh sistem: beberapa menit setelah berita tampil (acak 3–15 menit, diundi sistem), harga 4–7 aset berubah. Tim berdagang di laptop yang disediakan panitia (masuk dengan memindai kartu QR); permainan berlangsung 3 hari. Tim dengan net worth tertinggi menang.

Setiap tim **mulai dari Rp 0**. Satu-satunya sumber uang adalah hadiah dari pos, jadi tim harus bermain dulu sebelum bisa berdagang.

Hasil akhir yang diharapkan: acara berjalan tanpa data hilang, tanpa transaksi ganda, dan tanpa panitia harus menghitung manual.

## 2. Prinsip desain

- **Server menentukan segalanya.** Harga, stok, dan saldo hanya berubah lewat fungsi di server. Layar peserta hanya menampilkan.
- **Sederhana dan bisa diperbaiki saat acara berjalan.** Panitia harus bisa mengoreksi saldo, harga, dan stok dari panel admin tanpa menyentuh database.
- **Semua tercatat.** Setiap perubahan uang dan harga punya jejak audit: siapa, kapan, berapa, alasannya.
- **Hadiah pos langsung masuk saldo, tanpa persetujuan admin (diputuskan 13 Nov).** Penjaga memindai kartu QR dan mengetik nominal; saldo tim bertambah seketika. Tidak ada batas nominal, tidak ada batas kunjungan, dan tidak ada pengaman pengganti. Konsekuensinya diterima: salah ketik atau penjaga curang langsung berpengaruh; satu-satunya pemulihan adalah koreksi saldo oleh admin sesudahnya (`admin_adjust_cash`), dan semua hadiah tercatat per penjaga di tabel `payouts` dan `audit_log`.
- **Terinspirasi cara kerja, bukan salinan.** Proyek ini tidak memakai nama, merek, kode, aset visual, atau daftar aset dari platform lain. Aset, tema, dan aturan dibuat sendiri (lihat [05-game-rules](05-game-rules.md)).

## 3. Ruang lingkup

### Termasuk (versi 1)

| Area | Fitur |
|------|-------|
| Market | Daftar aset, beli, jual, portofolio, riwayat transaksi |
| Panel admin | Atur harga dan stok, siapkan kumpulan berita, kelola tim dan pos, buka/tutup pasar, koreksi saldo |
| Pos game | Penjaga memindai kartu QR tim dan mengisi nominal hadiah; saldo tim langsung bertambah |
| Harga digerakkan berita | Sistem memilih berita secara acak berbatas dari kumpulan siap; harga aset yang ditentukan berita itu berubah pada waktu acak 3–15 menit sesudah tampil (diundi sistem); panitia tidak bisa mengubah harga, berita, atau waktunya sejak game dibuka; tanpa pergerakan harga acak |
| Leaderboard | **5 tim teratas** di **layar ruang publik** (akun `display`), tiap kartu memuat nama tim, total, saldo, dan nilai aset; bisa disembunyikan/dibekukan panitia. Tidak ada di halaman akun tim |
| Audit dan ekspor | Log semua perubahan, ekspor hasil akhir ke CSV |

### Tidak termasuk (versi 1)

- Pendaftaran mandiri. Semua akun dibuat panitia.
- Perdagangan antar tim.
- Grafik harga canggih. Cukup tabel dan grafik sederhana dari `price_history`.
- Aplikasi mobile native. Web responsif sudah cukup.
- Pembayaran uang sungguhan. Semua uang adalah poin virtual.

## 4. Peran pengguna

| Peran | Siapa | Boleh | Tidak boleh |
|-------|-------|-------|-------------|
| `team` | Satu akun per tim, dipakai di **laptop trading panitia** (masuk dengan memindai kartu QR tim) | Lihat pasar, beli dan jual, lihat portofolio, riwayat, dan status hadiah sendiri, lihat berita | Mengubah saldo, harga, stok; melihat data tim lain; **melihat leaderboard** |
| `guard` | Penjaga pos | Memindai QR tim, memberi hadiah untuk pos miliknya (langsung masuk saldo), membuka/menutup posnya, melihat hadiah yang ia berikan | Memberi hadiah atas nama pos lain; melihat daftar tim atau saldo tim selain yang kartunya sedang dipindai; melihat leaderboard |
| `admin` | Panitia inti. Disarankan ≥ 3 orang dengan pembagian tugas: **satu mengurus berita dan pasar** (menyiapkan kumpulan berita, membuka/menutup pasar), **satu berjaga sebagai cadangan dan koreksi saldo**. Semuanya berperan `admin` (satu peran, hak sama) | Semua pengelolaan, menyiapkan berita, membuka/menutup pasar, koreksi saldo dan harga, ekspor | — (tetap tercatat di audit) |
| `display` | Satu akun untuk komputer/layar di ruang publik | Membaca leaderboard dan data pasar publik | Semua aksi tulis; melihat saldo per tim selain lewat leaderboard |

Satu akun hanya punya satu peran.

## 5. Alur permainan singkat

1. **Persiapan (`setup`).** Panitia membuat akun tim, pos, dan aset. Pasar tertutup.
2. **Pembukaan (`open`).** Panitia menekan *Buka pasar* tiap pagi (dan *Tutup pasar* tiap sore). Semua tim bersaldo Rp 0; mereka mulai berkeliling pos. Berita pertama dipilih sistem begitu pasar dibuka.
3. **Berita dan harga.** Sistem memilih satu berita secara acak dari kumpulan yang sudah disiapkan (membuang yang akan membuat harga menabrak batas); berita tampil di layar publik dan di laptop trading, dan **3 sampai 15 menit kemudian** (diundi acak oleh sistem untuk tiap berita) harga 4–7 aset yang ditentukan berita itu berubah serentak. Berita berikutnya dipilih sistem begitu itu selesai. Urutan dan waktunya tidak ditentukan panitia. Tidak ada pergerakan harga acak.
4. **Hadiah pos.** Setelah game di pos selesai, tim menunjukkan QR-nya. Penjaga memindai, mengisi nominal, dan mengirim. Uang langsung masuk ke saldo tim; tidak ada persetujuan admin.
5. **Trading.** Tim yang sudah punya saldo datang ke laptop trading, memindai kartu QR-nya untuk masuk, lalu membeli dan menjual selama pasar `open`. Sesi keluar otomatis setelah 5 menit tanpa gerakan.
6. **Jeda (`paused`).** Panitia bisa menghentikan sementara trading dan siklus berita, misalnya saat ada masalah; hitungan menuju perubahan harga ikut berhenti. Pemberian hadiah pos tetap berjalan.
7. **Selesai (`finished`).** Admin menekan **Selesai** setelah perubahan harga terakhir (bukan setelah berita terakhir). Pasar ditutup, leaderboard dibekukan, hasil diekspor. Berita yang masih `live` harus selesai dulu (atau dibatalkan dengan `force`).

## 6. Istilah

| Istilah | Arti |
|---------|------|
| Net worth | Saldo (bebas + terkunci di order) + Σ unit × **harga transaksi terakhir** tiap aset (diputuskan 17 Nov; menggantikan harga beli 16 Nov) |
| Aset | Barang yang diperdagangkan, misalnya saham perusahaan nyata dengan harga rekaan. Punya harga dan stok |
| Stok | Jumlah unit aset yang tersedia di pasar |
| Pos | Titik game fisik. Dijaga satu penjaga |
| Hadiah pos | Uang yang diterima tim setelah game di pos, **setelah disetujui admin** |
| QR tim | Kode unik per akun tim yang ditunjukkan ke penjaga. Hanya mengidentifikasi tim |
| Hadiah (`payouts`) | Catatan hadiah yang diberikan penjaga (tim + nominal + pos); langsung menambah saldo |
| Siklus berita | Berita tampil → 3–15 menit acak → harga berubah → berita berikutnya (jeda default 0) |
| Layar publik | Akun `display` yang menampilkan leaderboard di ruang bersama |
| Berita | Teks yang disiapkan admin dan dipilih otomatis oleh sistem; memuat petunjuk tentang sifat perusahaan. Efeknya pada 4–7 aset ditetapkan penulis berita dan diterapkan pada waktu acak 3–15 menit setelah tayang (diundi sistem) |
| Idempotensi | Aksi yang sama dikirim dua kali hanya tercatat sekali |
| RPC | Fungsi PostgreSQL yang dipanggil dari aplikasi lewat Supabase |
| RLS | Row Level Security, aturan akses per baris di PostgreSQL |

## 7. Asumsi dan batasan

- **Tim tidak membawa ponsel.** Mereka hanya membawa kartu QR. Trading dilakukan di laptop yang disediakan panitia (jumlah belum pasti, banyak), memakai kamera laptop untuk memindai QR. Hanya panitia dan penjaga yang membawa ponsel.
- Server dijalankan dengan Docker (Supabase self-hosted + aplikasi web) di server milik guru di sekolah, dan dibuka ke laptop trading serta ponsel penjaga lewat **Cloudflare Tunnel** dengan domain milik panitia (HTTPS dari Cloudflare, jadi kamera bisa dipakai). Lihat [11-deployment](11-deployment.md).
- Jumlah sesi bersamaan di bawah 50 (laptop trading yang sedang dipakai + 12 penjaga + beberapa admin + 1 layar publik). Tim tidak punya perangkat sendiri.
- Penjaga punya ponsel dengan kamera untuk memindai QR (tidak ada jalur kode cadangan di UI; kartu atau kamera yang rusak diganti).
- **Titik rawan utama sekarang adalah penjaga:** tanpa ACC dan tanpa batas nominal, satu salah ketik (mis. tambahan nol) atau satu penjaga yang curang langsung menggeser peringkat. Ini keputusan panitia; mitigasinya hanya briefing penjaga, pengawasan manusia, dan koreksi admin sesudahnya.
- Daftar aset beserta rentang harga dan stok awalnya, dan bahan berita (teks, kalimat pengecoh, kunci jawaban), disiapkan panitia **sebelum acara**. Sistem hanya menyimpan dan menjalankannya.
- Satu event, satu database. Tidak ada multi-tenant.
- **Tiga hari acara**, pasar buka 08.00–19.00 WIB tiap hari. Admin membuka dan menutup pasar dengan tombol; tidak ada jadwal otomatis. Data event sebelumnya tidak perlu dipertahankan, tetapi data harus bertahan antar hari (cadangan rutin, lihat 11).

## 8. Dasar observasi platform acuan

Dokumen ini dirancang setelah mempelajari cara kerja sebuah platform lomba serupa dengan membaca halaman dan respons API yang dilihat akun peserta (hanya baca, tanpa aksi tulis). Ringkasannya, dipisah menurut kepastian:

**Teramati langsung**
- Ada tiga bagian: daftar pos aktivitas, pasar aset, dan riwayat transaksi.
- Setiap aset punya nama, harga, dan stok. Harga berubah dari waktu ke waktu: harga di riwayat transaksi berbeda dengan harga pasar saat ini.
- Setiap transaksi menyimpan harga satuan saat transaksi terjadi.
- Pos punya nama, lokasi, status buka/tutup, dan satu akun penjaga.
- Pengumuman berisi berita.
- Ada kanal realtime (Socket.IO) selain REST API.

**Dugaan (tidak terbukti)**
- Harga digerakkan panitia atau berita.
- Uang modal tim berasal dari hasil game di pos.

**Tidak diketahui**
- Rumus harga, aturan konversi game ke uang, dan kriteria juara.

Karena itu, aturan di proyek ini **dirancang ulang** dan bukan tiruan. Lihat [05-game-rules](05-game-rules.md).

## 9. Keputusan yang masih terbuka

Panitia perlu memutuskan hal berikut sebelum implementasi mendalam. Nilai default dipakai kalau belum diputuskan.

| # | Pertanyaan | Default yang diusulkan |
|---|------------|------------------------|
| 1 | Nama acara dan tema visual | Placeholder "Classmeet Market" |
| 2 | Jumlah tim pasti | 16 |
| 3 | Jumlah pos dan daftar game | 10–12, daftar menyusul dari panitia |
| 4 | Uang awal tiap tim | **Rp 0 (diputuskan)** |
| 5 | Rentang hadiah per pos | **Diputuskan 13 Nov: tidak ada batas nominal maupun batas kunjungan.** Besaran hadiah per game ditentukan panitia secara lisan dengan penjaga |
| 6 | Daftar aset, profil, dan sifat tiap aset | **Menyusul dari panitia.** **Diputuskan 13 Nov:** 25 aset (5 sektor × 5), nama perusahaan asli, harga rekaan Rp 110.000 – Rp 800.000 (lihat [05](05-game-rules.md#5-aset)); profil dan sifat menyusul |
| 7 | Biaya jual (fee) | **Dipakai, 5 %** (diputuskan) (default skema tetap 0; seed mengaturnya) |
| 8 | Saat jual, stok kembali ke pasar? | Ya |
| 9 | Leaderboard | **Hanya di layar ruang publik, tidak di akun tim (diputuskan)**; dibekukan 15 menit sebelum akhir |
| 10 | Durasi event | **Diputuskan 13 Nov:** 3 hari, pasar buka 08.00–19.00, dibuka dan ditutup manual oleh admin |
| 11 | Siapa yang menjadi admin | **Diputuskan:** tambahan admin direkrut, satu untuk pasar/berita, satu cadangan; sistem ACC dihapus |
| 12 | Mekanisme harga | **Diputuskan:** harga tidak bergerak acak. Berita dipilih **sistem secara acak berbatas** dari kumpulan siap (±220 berita), harga berubah acak 3–15 menit kemudian, 4–7 aset per berita, **terkunci dari panitia sejak game dibuka**, efek 8–14 % (pedoman penulis; maksimum 15 %) |
| 13 | Batas jumlah beli per aset | **Diputuskan 16 Nov: tidak ada batas kepemilikan per tim** (sebelumnya 7–10 kumulatif); pembatasnya hanya stok (ditetapkan di awal, murah banyak, mahal sedikit) dan saldo |
| 14 | Perangkat layar publik | Satu laptop/TV yang login sebagai `display`; juga menampilkan berita yang sedang tayang |
| 17 | Perangkat tim | **Diputuskan 13 Nov:** tim tanpa ponsel; kartu QR dipindai penjaga (hadiah) dan di laptop trading (masuk akun); keluar otomatis 5 menit tanpa gerakan; tanpa PIN |
| 18 | Hosting | **Diputuskan 13 Nov:** Docker, Supabase self-hosted, server guru di sekolah, Cloudflare Tunnel + domain panitia |
| 15 | Bahan berita (teks, pengecoh, kunci jawaban) | Menyusul. Berita contoh 3 sudah diterima (lihat [05, bagian 4.3](05-game-rules.md#43-menulis-berita)); contoh 1 dan 3 versi awal yang identik sudah diselesaikan |
| 16 | Biaya transaksi | **Diputuskan 17 Nov: 0,25 % per sisi** (`fee_bps = 25`), menggantikan biaya jual 5 %; lihat [12](12-order-book.md) |
