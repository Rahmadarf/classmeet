# Panduan Trading Classmeet Market

Panduan untuk peserta yang **belum pernah trading**. Tidak perlu pengetahuan saham sama sekali. Semua istilah dan singkatan dijelaskan di bagian [Kamus istilah](#kamus-istilah-dan-singkatan); bagian lain menunjuk ke sana. Aturan lengkap untuk panitia ada di `docs/05-game-rules.md` dan `docs/12-order-book.md`.

## 1. Trading itu apa?

Bayangkan pasar jual-beli barang koleksi. Harga tiap barang naik-turun karena kabar yang beredar. Kalau kamu **membeli saat harga murah dan menjual saat harga naik**, selisihnya jadi keuntunganmu. Kalau kamu membeli lalu harganya turun dan kamu menjual, kamu rugi.

Di game ini:

- "Barang" yang diperdagangkan disebut **aset**. Tiap aset mewakili sebuah perusahaan (misalnya Adaro, BCA, Garuda Indonesia). Kamu membeli **unit** aset itu, seperti membeli saham.
- Kamu tidak perlu menawar langsung ke orang lain. Sistem yang mencocokkan pembeli dan penjual (lihat [Order book](#order-book-dan-cara-sistem-mencocokkan-order)).
- Menang = **net worth** (total kekayaan) tertinggi saat game selesai.

### Aturan dasar

- Tim mulai dari **Rp 0**. Uang hanya datang dari **hadiah pos** (kamu mengunjungi pos, bermain game di sana, dan penjaga memberi uang).
- Harga aset berubah **hanya karena berita**. Berita terbit, dan **3–15 menit kemudian** (acak) harga aset yang disebut di berita itu bergerak. Selama menunggu, harga lama masih berlaku. **Di sinilah peluang untung**: kalau kamu bisa menebak aset mana yang akan naik dari berita yang baru terbit, beli sekarang sebelum harganya naik.
- Trading hanya bisa saat pasar **Buka** (08.00–19.00 WIB, selama 3 hari; admin yang membuka dan menutup). Saat pasar tutup, kamu tidak bisa memasang atau membatalkan order.
- Masuk ke akun dengan memindai **kartu QR** timmu di laptop kiosk. Sesi keluar sendiri setelah 5 menit tanpa gerakan, atau saat kamu menekan _Selesai_. Order yang sudah antre tetap berjalan walau kamu sudah keluar.
- Tidak ada pinjaman, tidak ada jual kosong (menjual aset yang tidak kamu punya), dan saldo tidak boleh negatif.

## 2. Cara untung, langkah demi langkah

Contoh dengan angka (biaya transaksi 0,25 % per sisi):

1. Berita terbit dan petunjuknya mengarah ke aset X. Harga X sekarang **Rp 100.000**. Kamu beli **10 lot** (= 10 unit).
2. Pembelian: 10 × 100.000 = Rp 1.000.000, ditambah biaya Rp 2.500. Total uang keluar: **Rp 1.002.500**.
3. Beberapa menit kemudian harga X naik 10 % menjadi **Rp 110.000**. Kamu jual 10 lot.
4. Penjualan: 10 × 110.000 = Rp 1.100.000, dikurangi biaya Rp 2.750. Uang masuk: **Rp 1.097.250**.
5. Keuntungan bersih = 1.097.250 − 1.002.500 = **Rp 94.750**.

Kalau harga justru turun jadi Rp 90.000 lalu kamu jual, kamu rugi sekitar Rp 100.000 lebih. Karena biaya dikenakan di **kedua** sisi (beli dan jual), harga harus naik sekitar **0,5 %** hanya agar kamu **impas** (tidak untung, tidak rugi).

### Untung "di atas kertas" vs untung sungguhan

Di halaman **Portofolio**, untung/rugi dihitung dari harga sekarang dibanding harga belimu. Itu baru **untung/rugi belum terealisasi**: angkanya masih bisa berubah. Kamu baru benar-benar mengantongi untung setelah **menjual** (uang masuk ke saldo). Namun **net worth** (yang menentukan juara) sudah ikut menghitung nilai aset yang kamu pegang, jadi menahan aset yang naik juga menaikkan peringkatmu.

## 3. Cara membeli

1. Buka **Pasar** dan pilih aset di daftar kiri.
2. Di form order, pilih tab **Beli**.
3. Pilih jenis order:
   - **Limit**: kamu tentukan **harga** dan **jumlah lot**. Order masuk antrean dan baru terisi kalau ada penjual di harga itu atau lebih murah. Cocok kalau kamu tidak terburu-buru dan ingin harga tertentu.
   - **Market**: kamu hanya isi **jumlah lot**. Order langsung membeli dari penjual dengan harga paling murah yang tersedia. Cocok kalau kamu harus cepat (misalnya berita baru terbit). Harga akhirnya bisa sedikit berbeda dari estimasi di form.
4. Untuk limit, harga harus kelipatan **fraksi harga** dan berada di antara **ARB** dan **ARA** (lihat kamus). Tombol **−** dan **+** di kolom harga menggeser satu fraksi.
5. Periksa ringkasan di form: jumlah, biaya, dan **total yang dikunci**, lalu tekan tombol pasang order.
6. Kalau saldo tidak cukup, order ditolak dan form memberi tahu berapa lot yang masih terjangkau.

Saat order beli limit dipasang, uangnya **dikunci** (harga × lot + biaya) supaya tidak terpakai dua kali. Kalau kamu membatalkan, kuncinya kembali.

## 4. Cara menjual

Ada dua jalan:

- Dari **Pasar**: pilih aset, lalu tab **Jual**.
- Dari **Portofolio**: tekan **Jual** di baris aset. Pasar terbuka pada tab Jual untuk aset itu.

Pilih **Limit** (tentukan harga minimal yang kamu mau) atau **Market** (jual sekarang ke pembeli dengan harga tertinggi yang tersedia), isi lot, lalu kirim. Kamu hanya bisa menjual aset yang **kamu miliki**, dan lot yang sudah dipakai di order jual lain tidak bisa dijual dua kali. Uang yang masuk sudah dipotong biaya 0,25 %.

## 5. Order book dan cara sistem mencocokkan order

**Order book** (buku order) adalah daftar antrean semua order yang belum terisi untuk satu aset. Isinya dua sisi:

- **Bid** (sisi beli): harga yang **ingin dibayar** pembeli. Ditampilkan 5 level, harga tertinggi di atas.
- **Offer** (sisi jual, disebut juga _ask_): harga yang **diminta** penjual. Ditampilkan 5 level, harga terendah di atas.

Cara membacanya: selalu ada celah antara bid tertinggi dan offer terendah. Kalau kamu ingin **membeli sekarang**, kamu membayar offer terendah. Kalau ingin **menjual sekarang**, kamu menerima bid tertinggi. Order **limit** yang harganya belum bertemu akan menunggu di antrean sampai ada lawan yang cocok.

Cara pencocokan (otomatis di server):

- Harga terbaik didahulukan, lalu order yang masuk lebih dulu.
- Order bisa terisi **sebagian** (misalnya kamu pasang 10 lot, baru 4 lot yang terisi; sisa 6 lot tetap antre).
- Lawanmu bisa **bandar** (panitia) atau tim lain. Order dari tim yang sama tidak saling dicocokkan.

## 6. Penjelasan halaman

### Halaman Pasar

- **Fungsi:** tempat memasang order dan membaca kondisi pasar.
- **Isinya:**
  - Daftar aset dengan harga terakhir dan perubahannya (▲ naik, ▼ turun).
  - Kartu detail aset dengan sepuluh angka statistik (artinya ada di kamus).
  - **Order book**: 5 level bid dan 5 level offer. Lot milik timmu ditandai.
  - Form order (Beli/Jual, Limit/Market, harga, jumlah lot).
  - Daftar order terbukamu, dengan tombol Batalkan.
- **Kegunaan:** menentukan harga yang masuk akal, melihat apakah banyak yang antre, lalu membeli atau menjual.
- **Harga di sini = harga transaksi terakhir**, bukan harga peringkat.

### Halaman Order

- **Fungsi:** memantau dan membatalkan order yang belum selesai.
- **Isinya:**
  - Tiga angka: jumlah order antre, saldo terkunci, aset terkunci.
  - Tabel **Order antre**: aset, sisi (Beli/Jual), jenis, harga, lot, terisi, dikunci, waktu, dan tombol **Batalkan**.
  - **Riwayat order hari ini**: order yang sudah terisi penuh atau dibatalkan.
- **Kegunaan:**
  - Memeriksa kenapa saldo atau asetmu terkunci.
  - Membatalkan order yang harganya sudah tidak cocok dengan situasi (misalnya berita baru terbit). Pembatalan mengembalikan sisa uang atau aset yang terkunci.
  - Pembatalan hanya bisa saat pasar buka.

### Halaman Portofolio

- **Fungsi:** melihat apa yang kamu pegang dan berapa untung atau ruginya.
- **Isinya:**
  - Kartu **total nilai aset** dan **untung/rugi total** (nominal dan persen).
  - Satu baris per aset: jumlah unit, harga beli rata-rata (sudah termasuk biaya beli), nilai sekarang, untung/rugi, dan tombol **Jual**.
- **Nilai di sini memakai harga peringkat** (lihat kamus), bukan harga terakhir di Pasar, jadi angkanya bisa sedikit berbeda dari Pasar. Angka yang sama dipakai di Beranda dan papan peringkat.
- **Kegunaan:** memutuskan aset mana yang dijual (sudah untung, atau efek beritanya sudah lewat) dan aset mana yang masih ditahan.

## 7. Event khusus (datang bersama berita)

Selain menggeser harga, sebuah berita bisa membawa **event** pada satu aset. Event berjalan saat berita itu berlaku (3–15 menit setelah terbit), jadi petunjuknya ada di berita, bukan di pengumuman terpisah.

| Event        | Yang terjadi                                                                                                                                                                                                        | Yang sebaiknya kamu lakukan                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dividen**  | Semua tim yang **memegang** aset itu menerima uang: jumlah unit × dividen per unit (persen tertentu dari harga acuan). Harga tidak dipotong. Tercatat di **Riwayat** sebagai "Dividen".                             | Memegang aset sebelum dividen cair menguntungkan, tetapi waktunya acak. Dividen tidak otomatis berarti harga naik.                             |
| **Suspensi** | Aset **dihentikan sementara** (1–30 menit): order baru ditolak, bandar menarik kuotasinya. Order antre tetap bisa dibatalkan. Tampil sebagai banner "Suspensi" di Pasar dengan hitung mundur, lalu dibuka otomatis. | Tidak bisa membeli atau menjual aset itu selama suspensi. Batalkan order antre bila tidak lagi cocok.                                          |
| **Bangkrut** | Aset **hilang dari Pasar selamanya**. Order antre dibatalkan, dan unit yang kamu pegang **diganti uang** sebesar persen kecil dari harga acuan (bawaan 10 %, bisa 0 %). Tampil sebagai banner "Bangkrut".           | Kalau berita mengisyaratkan perusahaan terpuruk, menjual lebih dulu menyelamatkan nilai aset. Menahan sampai bangkrut hampir pasti rugi besar. |

Karena unit yang dilikuidasi atau dividen langsung masuk ke saldo, cek **Beranda** dan **Riwayat** setelah event.

## 8. Urutan main yang disarankan

1. Dapat hadiah di pos, lalu cek saldo di Beranda.
2. Baca berita dan cocokkan petunjuknya dengan profil aset.
3. Beli di **Pasar** (Limit kalau tidak terburu-buru, Market kalau harus cepat).
4. Pantau di **Order** sampai terisi.
5. Setelah harga bergerak, cek untung di **Portofolio**, lalu jual di **Pasar**.
6. Ulangi sampai game selesai. Peringkat dihitung dari net worth akhir.

Tips untuk pemula:

- Mulai dengan jumlah kecil sampai paham cara kerjanya.
- Jangan habiskan seluruh saldo di satu aset; berita bisa menguntungkan aset lain.
- Ingat biaya 0,25 % di kedua sisi: bolak-balik beli-jual tanpa alasan hanya menggerus saldo.
- Kalau ragu, pakai **Limit**, bukan Market, supaya kamu tahu harga maksimal yang akan kamu bayar.

## Kamus istilah dan singkatan

### Istilah dasar

| Istilah            | Arti                                                                                                        | Untuk apa                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Aset**           | Barang yang diperdagangkan; di game ini mewakili sebuah perusahaan.                                         | Yang kamu beli dan jual.                             |
| **Trading**        | Membeli dan menjual aset untuk mencari untung dari selisih harga.                                           | Tujuan utama permainan.                              |
| **Unit**           | Satu satuan aset.                                                                                           | Yang kamu miliki di Portofolio.                      |
| **Lot**            | Satuan jumlah order. Di game ini **1 lot = 1 unit** (di bursa sungguhan 1 lot = 100 saham; di sini tidak).  | Menentukan berapa banyak yang dibeli atau dijual.    |
| **Order**          | Perintah membeli atau menjual yang kamu kirim ke sistem.                                                    | Cara satu-satunya untuk bertransaksi.                |
| **Transaksi**      | Hasil ketika order beli dan order jual bertemu dan terisi.                                                  | Menentukan harga terakhir dan mengubah saldo/asetmu. |
| **Bandar**         | Pihak panitia yang selalu memasang 5 bid dan 5 offer di sekitar harga acuan, dengan stok terbatas.          | Menjamin selalu ada lawan transaksi.                 |
| **Stok**           | Persediaan aset yang dipegang bandar. Kalau habis, tidak ada yang bisa dibeli dari bandar.                  | Membuat harga terasa saat banyak yang membeli.       |
| **Biaya**          | 0,25 % dari nilai transaksi, dibayar **pembeli dan penjual**, dibulatkan ke atas.                           | Dibayar ke panitia setiap order terisi.              |
| **Net worth**      | Total kekayaan = saldo bebas + saldo terkunci + nilai aset yang dipegang (dihitung dengan harga peringkat). | **Penentu juara.**                                   |
| **Saldo bebas**    | Uang yang belum terkunci dan bisa langsung dipakai.                                                         | Modal untuk order beli baru.                         |
| **Saldo terkunci** | Uang yang ditahan untuk order beli limit yang masih antre.                                                  | Mencegah uang yang sama dipakai dua kali.            |
| **Aset terkunci**  | Unit yang ditahan untuk order jual yang masih antre.                                                        | Mencegah unit yang sama dijual dua kali.             |
| **Untung/rugi**    | Selisih nilai sekarang dengan harga belimu (termasuk biaya). Di tampilan: ▲ untung, ▼ rugi.                 | Menilai apakah sebuah aset sebaiknya dijual.         |
| **Impas**          | Kondisi tidak untung dan tidak rugi. Karena ada biaya, harga harus naik ±0,5 % dari harga beli.             | Batas minimal agar penjualan tidak rugi.             |

### Jenis order

| Istilah                            | Arti                                                                                                                                      | Untuk apa                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Limit**                          | Order dengan harga yang kamu tentukan. Antre sampai terisi, kamu batalkan, atau pasar ditutup.                                            | Mengontrol harga; cocok saat tidak terburu-buru.          |
| **Market**                         | Order tanpa harga; langsung dicocokkan ke harga terbaik yang tersedia (menyapu paling banyak 5 level, sisa yang tidak terisi dibatalkan). | Cepat dan pasti terisi, tetapi harga akhir tidak dijamin. |
| **Antre** (_open_)                 | Status order yang belum terisi penuh dan masih menunggu lawan.                                                                            | Muncul di halaman Order.                                  |
| **Terisi** (_filled_)              | Order sudah dicocokkan seluruhnya.                                                                                                        | Muncul di Riwayat order.                                  |
| **Partial fill** / terisi sebagian | Hanya sebagian lot yang terisi; sisanya masih antre.                                                                                      | Wajar terjadi; sisa bisa dibatalkan.                      |
| **Batalkan**                       | Menarik order antre; uang/aset yang terkunci kembali.                                                                                     | Dipakai saat harga order sudah tidak relevan.             |

### Order book dan harga

| Istilah                                    | Arti                                                                                                                                                                                                                         | Untuk apa                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Order book**                             | Daftar antrean order beli dan jual untuk satu aset.                                                                                                                                                                          | Melihat seberapa ramai pembeli dan penjual.                              |
| **Bid**                                    | Harga yang ingin dibayar pembeli (sisi beli). Level tertinggi = harga jual terbaik untukmu.                                                                                                                                  | Tahu harga yang kamu terima jika menjual sekarang.                       |
| **Offer** (_ask_)                          | Harga yang diminta penjual (sisi jual). Level terendah = harga beli terbaik untukmu.                                                                                                                                         | Tahu harga yang kamu bayar jika membeli sekarang.                        |
| **Level**                                  | Satu baris harga di order book, berisi total lot dan jumlah antrean di harga itu.                                                                                                                                            | Menunjukkan kedalaman antrean.                                           |
| **Fraksi harga**                           | Kelipatan harga yang diizinkan (Rp 500, Rp 1.000, atau Rp 2.500, tergantung rentang harga).                                                                                                                                  | Harga limit harus kelipatan fraksi; tombol −/+ menggesernya satu fraksi. |
| **Harga acuan**                            | Harga dasar sebuah aset. Hanya berubah oleh berita. Layar menampilkannya sebagai **Acuan**.                                                                                                                                  | Patokan untuk batas ARA/ARB dan pembanding perubahan.                    |
| **Harga terakhir**                         | Harga transaksi terakhir. Ini harga yang tampil di Pasar.                                                                                                                                                                    | Gambaran harga pasar saat ini.                                           |
| **Harga peringkat**                        | Harga yang dipakai untuk menghitung net worth, Beranda, Portofolio, dan peringkat (lihat **VWAP**).                                                                                                                          | Membuat peringkat tidak mudah dimanipulasi satu transaksi.               |
| **VWAP** (_Volume-Weighted Average Price_) | Harga rata-rata yang memberi bobot lebih ke transaksi yang volumenya besar. Harga peringkat memakai VWAP transaksi **10 menit** terakhir; kalau volumenya kurang dari 5 lot, kekurangannya diisi harga peringkat sebelumnya. | Satu transaksi kecil tidak langsung menggeser peringkat.                 |
| **ARA** (_Auto Reject Atas_)               | Batas harga **tertinggi** yang boleh dipasang: sekitar **+15 %** dari harga acuan. Order di atasnya ditolak.                                                                                                                 | Mencegah harga naik liar.                                                |
| **ARB** (_Auto Reject Bawah_)              | Batas harga **terendah** yang boleh dipasang: sekitar **−15 %** dari harga acuan. Order di bawahnya ditolak.                                                                                                                 | Mencegah harga jatuh liar.                                               |

### Angka statistik di kartu aset (Pasar)

Angka-angka ini dihitung dari **semua transaksi sejak game dimulai**, bukan per hari. Kalau belum ada transaksi, tampil "–" atau 0.

| Istilah                | Arti                                                                                                                                                               | Untuk apa                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Open**               | Harga transaksi **pertama** untuk aset itu.                                                                                                                        | Titik awal untuk melihat tren.                  |
| **High**               | Harga transaksi **tertinggi** sejauh ini.                                                                                                                          | Mengetahui puncak harga.                        |
| **Low**                | Harga transaksi **terendah** sejauh ini.                                                                                                                           | Mengetahui dasar harga.                         |
| **Acuan**              | Harga acuan (lihat di atas). Menggantikan "Prev" (harga penutupan kemarin) di desain awal karena game ini tidak punya penutupan harian.                            | Pembanding harga sekarang.                      |
| **Avg** (_Average_)    | Harga rata-rata tertimbang semua transaksi.                                                                                                                        | Mengetahui harga "wajar" selama ini.            |
| **ARA / ARB**          | Lihat di atas; di sini menunjukkan angka batas yang berlaku sekarang.                                                                                              | Mengetahui rentang harga yang boleh dipasang.   |
| **Lot**                | **Total** lot yang sudah diperdagangkan untuk aset itu.                                                                                                            | Mengukur seberapa ramai aset diperdagangkan.    |
| **Val** (_Value_)      | **Total nilai rupiah** semua transaksi aset itu (harga × lot, dijumlahkan). Ditampilkan ringkas, mis. "38,3 jt".                                                   | Mengukur besarnya uang yang berputar.           |
| **Freq** (_Frequency_) | **Jumlah transaksi** yang pernah terjadi. **Catatan:** di tabel order book, "Freq" berarti jumlah **order yang antre** di level harga itu, bukan jumlah transaksi. | Mengukur seberapa sering aset diperjualbelikan. |

### Singkatan pada nominal

| Tulisan | Arti                                                         |
| ------- | ------------------------------------------------------------ |
| **Rp**  | Rupiah.                                                      |
| **jt**  | Juta. "38,3 jt" = Rp 38.300.000.                             |
| **M**   | Miliar. "1,3 M" = Rp 1.300.000.000.                          |
| **%**   | Persen. Biaya 0,25 % artinya Rp 250 untuk setiap Rp 100.000. |

### Istilah di layar publik (Display) dan status game

| Istilah                                 | Arti                                                                                                                                                                            | Untuk apa                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **IKC**                                 | Indeks gabungan seluruh aset: rata-rata (harga terakhir ÷ harga awal) × 1000, bobot semua aset sama. Di atas 1000 = pasar rata-rata naik sejak awal.                            | Gambaran kesehatan pasar secara keseluruhan di layar publik.             |
| **Indeks sektor**                       | Indeks yang sama, tetapi hanya untuk aset satu sektor (misalnya Energi).                                                                                                        | Melihat sektor mana yang sedang naik atau turun.                         |
| **Dividen**                             | Uang yang dibayar ke tim pemegang aset saat berita berlaku, besarnya persen dari harga acuan per unit.                                                                          | Tambahan penghasilan selain untung dari kenaikan harga.                  |
| **Suspensi**                            | Penghentian perdagangan satu aset selama beberapa menit; order baru ditolak, order antre boleh dibatalkan.                                                                      | Mencegah transaksi saat ada isu besar; dibuka kembali otomatis.          |
| **Bangkrut** (delisting)                | Aset dihapus dari pasar; unit yang dipegang diganti uang sebesar persen kecil dari harga acuan.                                                                                 | Peristiwa terburuk bagi pemegang aset; berita biasanya memberi petunjuk. |
| **Sektor**                              | Kelompok aset sejenis (Energi, Pangan, Transportasi, dst.).                                                                                                                     | Mengelompokkan aset dan membantu membaca dampak berita.                  |
| **Berita**                              | Kabar yang terbit lalu menggerakkan harga beberapa aset setelah 3–15 menit. Berisi **petunjuk inti** dan beberapa kalimat **pengecoh**.                                         | Sumber utama peluang untung.                                             |
| **Leaderboard**                         | Papan peringkat net worth tim, hanya tampil di layar ruang publik. Bisa dibekukan 15 menit sebelum akhir.                                                                       | Persaingan antar tim.                                                    |
| **Status pasar: Buka / Jeda / Selesai** | _Buka_: trading berjalan. _Jeda_ (ditutup admin): tidak bisa memasang/membatalkan order, harga tidak bergerak. _Selesai_: game berakhir, semua order antre dibatalkan otomatis. | Menentukan kapan kamu bisa bertransaksi.                                 |
| **Pos**                                 | Stasiun aktivitas tempat penjaga memberi hadiah uang.                                                                                                                           | Satu-satunya sumber uang.                                                |
| **QR**                                  | Kode pada kartu tim. Dipindai penjaga untuk menerima hadiah dan dipindai di laptop kiosk untuk masuk ke akun.                                                                   | Identitas timmu; jaga kartunya.                                          |
