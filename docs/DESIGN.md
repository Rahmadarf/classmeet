# DESIGN — Classmeet Market

Identitas visual untuk seluruh antarmuka ([07-ui-ux](07-ui-ux.md) mengatur struktur dan alur; dokumen ini mengatur **rupa**). Dokumen ini disinkronkan dengan desain di Figma (file *BukuKu*, section *Rally Game*, diperbarui 17 Nov 2026). **Bila Figma dan dokumen ini berbeda, Figma yang menang; perbarui dokumen.**

**Mode: light saja** (diputuskan 17 Nov 2026; sebelumnya tema biru gelap). **Sidebar dan bilah atas penjaga juga putih**; biru royal pindah dari sidebar menjadi warna **tombol utama** (menggantikan oranye), sedangkan oranye tinggal aksen. Tidak ada dark mode dan tidak ada toggle tema. Versi biru gelap diarsipkan di Figma sebagai section *Rally Game (biru gelap, arsip)*.

Satu aturan keras:

> **Tidak ada latar hitam atau hampir hitam.** Itu mencakup halaman, kartu, overlay, bulatan toggle, isian, dan kotak di dalam kartu. Permukaan tergelap yang diizinkan adalah `--primary` `#0D2BE3` (biru royal, untuk tombol utama dan checkbox). Overlay dan bayangan memakai biru transparan, bukan hitam. Warna gelap `#03071E` dan `#0B1437` hanya boleh menjadi **warna teks atau ikon**, tidak pernah latar.

Putih sekarang **boleh** dan menjadi latar kartu (`--bg-1`). Aturan lama "tanpa latar putih" dicabut 17 Nov.

## 1. Sumber warna

Palet dibuat dari dua sumber: **biru royal situs IT FEST** (identitas: tombol utama, tautan, tombol sekunder) dan **maskot** (aksen). Warna IT FEST diukur langsung dari situsnya lewat peramban pada 16 Nov 2026; warna maskot diekstrak dari gambar maskot yang kamu berikan. Pada mode light, biru royal tidak lagi menjadi latar halaman: ia menjadi warna tombol utama, tautan, dan teks biru, sementara halaman, kartu, dan sidebar terang.

### 1.1 Dari IT FEST

| Hex | Peran di IT FEST | Dipakai sebagai |
|-----|------------------|-----------------|
| `#0D2BE3` | Latar halaman | **Tombol utama** (`--primary`), tautan (`--link`) |
| `#081CA3` | Kartu dan panel | Tidak dipakai lagi sebagai latar (kartu kini putih) |
| `#CDF22B` (lime) | Tombol utama dan aksen | **Tidak dipakai.** Diganti oranye maskot |
| `#03071E` | Teks gelap di atas tombol lime | **Teks di atas aksen terang** (`--text-on-accent`), hanya teks |
| `#A8B8EB` | Teks redup | Tidak dipakai |

### 1.2 Dari maskot (aksen dan teks)

| Hex | Asal di maskot | Dipakai sebagai |
|-----|----------------|-----------------|
| `#306FF8` | Biru jubah | Dasar `--blue` (ubin inisial), digelapkan sedikit menjadi `#2A5FE6` agar teks putih di atasnya lolos 5,4:1 |
| `#82AFF9` | Sorotan jubah | **Biru muda**: peringkat 2, isian pil, hiasan. **Bukan teks** di latar terang |
| `#FA9F1F` | Api, sepatu | **Oranye**: aksen saja (penanda menu aktif, lambang, peringkat 3). Sebagai teks memakai varian gelap `--accent-text` |
| `#FBCD3A` | Api, ujung kuning | **Kuning**: peringkat 1, banner. Hanya isian |
| `#25EEEF` | Layar visor | **Sian**: isian chip dan indikator; sebagai teks memakai `--cyan-text` |
| `#F2F1F2` | Rambut dan badan | Tidak dipakai lagi sebagai teks sidebar (sidebar kini putih); tersedia untuk teks di atas `--primary` bila perlu |
| `#C2BFC9` | Bayangan rambut | Tidak dipakai |

Tidak dipakai lagi: `#221E3C`, `#8A8AA1` (diganti `--text-dim` baru), `#2F4681`, `#3F67C0`, `#5B89EE`, `#C2802A`, `#71563E`.

## 2. Token warna

### 2.1 Latar dan permukaan

| Token | Hex | Dipakai untuk |
|-------|-----|---------------|
| `--page` | `#F3F6FF` | Latar halaman (biru sangat pucat) |
| `--bg-1` | `#FFFFFF` | **Kartu panel**, dialog, lembar form, toast, kartu aset |
| `--bg-0` | `#F3F6FF` | Kolom isian dan pencarian di atas kartu putih. **Selalu diberi garis tepi `--border-strong`** |
| `--bg-2` | `#EAF0FF` | Baris saat disentuh, baris belang, dropdown berhover |
| `--bg-3` | `#D6E0FF` | Ubin sekunder (nomor pos, ikon), penanda aktif yang kuat |
| `--sidebar` | `#FFFFFF` | **Sidebar** dan bilah atas penjaga, dipisah dari halaman oleh garis `--border` 1 px di tepi kanan (bilah atas: tepi bawah) |
| `--sidebar-card` | `#EAF0FF` | Kartu akun di dalam sidebar (garis `--border`) |
| `--nav-active` | `#EAF0FF` | Item menu terpilih di sidebar |
| `--border` | `#D3DCF7` | Garis tepi kartu dan pemisah baris (dekoratif) |
| `--border-strong` | `#8E9CD6` | Garis tepi isian, tombol sekunder bukan-teks (kontras 2,5:1 terhadap putih) |
| `--overlay` | `#0A21B4` pada 55 % (nilai tetap, bukan token sidebar) | Latar belakang dialog dan lembar form (biru transparan, bukan hitam) |

### 2.2 Teks

| Token | Hex | Dipakai untuk |
|-------|-----|---------------|
| `--text` | `#0B1437` | Judul, angka, isi |
| `--text-muted` | `#434D7E` | Subjudul, keterangan |
| `--text-dim` | `#5C6694` | Placeholder dan teks tersier (lolos 4,9–5,5:1 di `page`, `bg-1`, `bg-0`, `bg-2`; **tidak** di `bg-3`) |
| `--text-on-accent` | `#03071E` | Teks di atas oranye, kuning, sian, biru muda, hijau, merah, abu badge. **Hanya teks.** |

### 2.3 Aksen

Aksen terang (oranye, kuning, sian) sebagai **isian** tetap dari maskot. Sebagai **teks atau ikon di atas latar terang** ia gagal kontras, jadi tiap aksen punya varian gelap.

| Token | Hex | Peran |
|-------|-----|-------|
| `--primary` | `#0D2BE3` | **Tombol utama** (Beli, Kirim, Konfirmasi, Simpan, Tutup pasar) dan checkbox. Isian saja |
| `--on-primary` | `#FFFFFF` | Teks dan ikon di atas `--primary` (kontras 8,5:1) |
| `--accent` | `#FA9F1F` | **Aksen saja**: penanda menu aktif 3 px, lambang, badge peringkat 3. Isian saja; **bukan lagi tombol utama** |
| `--accent-text` | `#A35500` | Oranye sebagai teks/ikon (uang keluar di Riwayat, titik stok rendah) |
| `--accent-2` | `#FBCD3A` | Peringkat 1, banner sesi. Isian saja |
| `--blue` | `#2A5FE6` | Ubin inisial aset (huruf putih), bentuk dekoratif |
| `--blue-text` / `--link` | `#2A55D6` / `#0D2BE3` | Eyebrow, tombol sekunder (garis + teks) / tautan |
| `--blue-light` | `#82AFF9` | Peringkat 2, isian dekoratif. Bukan teks |
| `--cyan` | `#25EEEF` | Isian chip harga naik, cincin fokus (di atas latar terang diberi garis `--cyan-text`), indikator koneksi |
| `--cyan-text` | `#00717A` | Harga naik, uang masuk, lencana Baru (teks) |
| `--hero` | gradasi `#2A5FE6 → #0D2BE3` (135°) | **Kartu hero** Beranda (diubah ke biru 17 Nov; gradasi oranye dihapus) |

### 2.4 Pengecualian semantik: hijau dan merah

Maskot tidak punya hijau maupun merah, tetapi **toggle pos penjaga harus hijau/merah** (keputusan kamu), dan galat butuh warna yang jelas. Dua pasang token ini adalah **satu-satunya warna di luar maskot dan IT FEST**:

| Token | Hex | Boleh dipakai hanya untuk |
|-------|-----|---------------------------|
| `--ok` | `#34D399` | **Isian**: trek toggle pos (tersedia), isian pil "Tersedia" (pada 16–18 %) |
| `--ok-text` | `#09704A` | Teks dan garis pil "Tersedia", toast sukses |
| `--bad` | `#F87171` | **Isian**: trek toggle pos (tutup), isian pil "Tidak tersedia", chip harga turun (pada 14–16 %) |
| `--bad-text` | `#C0262D` | Teks dan garis pil "Tidak tersedia", pesan galat, toast gagal, harga turun |

Jangan dipakai untuk dekorasi atau grafik. "Hijau" yang pernah kamu minta diganti oranye adalah **lime IT FEST** (`#CDF22B`); itu sudah diganti.

### 2.5 Kontras terhitung (WCAG, rasio teks terhadap latar)

Dihitung ulang untuk mode light pada 17 Nov 2026 dengan skrip WCAG. Baca kolom "Boleh untuk" sebagai aturan.

| Teks | `--page` | `--bg-1` putih | `--bg-0` | `--bg-2` | `--bg-3` | Boleh untuk |
|------|---------|---------|---------|---------|---------|-------------|
| `--text` `#0B1437` | 16,62 | 17,96 | 16,62 | 15,74 | 13,65 | Semua teks |
| `--text-muted` `#434D7E` | 7,47 | 8,07 | 7,47 | 7,08 | 6,14 | Semua teks |
| `--text-dim` `#5C6694` | 5,14 | 5,55 | 5,14 | 4,87 | 4,22 | Semua teks kecuali di `bg-3` (hanya besar) |
| `--link` `#0D2BE3` | 7,86 | 8,50 | 7,86 | 7,45 | 6,46 | Semua teks |
| `--blue-text` `#2A55D6` | 5,77 | 6,23 | 5,77 | 5,46 | 4,74 | Semua teks |
| `--accent-text` `#A35500` | 5,04 | 5,45 | 5,04 | 4,77 | 4,14 | Teks di `page`, `bg-1`, `bg-0`, `bg-2`; di `bg-3` hanya besar |
| `--cyan-text` `#00717A` | 5,34 | 5,76 | 5,34 | 5,05 | 4,38 | Teks di `page`, `bg-1`, `bg-0`, `bg-2`; di `bg-3` hanya besar |
| `--ok-text` `#09704A` | 5,67 | 6,13 | 5,67 | 5,37 | 4,66 | Semua teks |
| `--bad-text` `#C0262D` | 5,47 | 5,90 | 5,47 | 5,18 | 4,49 | Teks di `page`, `bg-1`, `bg-0`, `bg-2`; di `bg-3` hanya besar |

Teks di atas isian aksen: `--text-on-accent` `#03071E` di atas `--accent` 9,54 · `--accent-2` 13,20 · `--cyan` 13,82 · `--blue-light` 8,97 · `--ok` 10,37 · `--bad` 7,21 · abu badge `#99A1B3` 7,70. Teks **putih** di atas `--blue` `#2A5FE6`: 5,42.

Di sidebar (putih) berlaku baris `--bg-1` pada tabel di atas; item aktif `--blue-text` di atas `--nav-active` `#EAF0FF` 5,46; kartu akun `#EAF0FF` memakai baris `--bg-2`. Teks putih di atas `--primary` `#0D2BE3` 8,50 (tombol utama); `--text-on-accent` tidak dipakai di tombol utama lagi.

Chip: `--cyan-text` di atas chip sian 16 % (`#DCFCFC`) 5,32; `--bad-text` di atas chip merah 16 % (`#FEE8E8`) 5,04; `--ok-text` di atas pil hijau 16 % (`#DFF8EF`) 5,49.

Garis: `--border` terhadap putih 1,37 dan `--border-strong` 2,47. Garis `--border` murni dekoratif; informasi tidak boleh bergantung padanya. Batas **isian** (komponen antarmuka, WCAG 1.4.11 butuh 3:1) memakai `--border-strong` plus latar `--bg-0`; bila diaudit ketat, naikkan ke `#6F7FC4` (≈3,9:1).

## 3. Aturan pemakaian

1. **Latar:** halaman `--page`; kartu dan dialog `--bg-1` putih; sidebar `--sidebar` putih bergaris `--border`; isian `--bg-0` bergaris `--border-strong`. Tidak ada latar hitam atau hampir hitam.
2. **Satu aksi utama per layar**, berwarna `--primary` dengan teks `--on-primary`. Aksi sekunder: garis 2 px `--blue-text` dengan teks `--blue-text`, atau isian `--bg-3`. Aksi berbahaya (akhiri game): `--bad-text` sebagai garis/teks, bukan isian besar.
3. **Naik/turun harga:** naik = chip isian `--cyan` 16 % + teks `--cyan-text` + ▲ + tanda `+`; turun = chip isian `--bad` 16 % + teks `--bad-text` + ▼ + tanda `−`, di kanan nama aset. Warna tidak pernah satu-satunya penanda (WCAG 1.4.1). Turun tidak memakai oranye agar tidak bertabrakan dengan tombol Beli.
4. **Uang masuk/keluar di Riwayat:** `+` dengan `--cyan-text`, `−` dengan `--accent-text`; ikon panah ikut tampil.
5. **Biru ubin `--blue`** tidak untuk teks. Ia dipakai pada ubin inisial (huruf putih, tebal), ilustrasi, dan grafik.
6. **Kuning `--accent-2`** hanya untuk isian: peringkat 1, banner. Bukan tombol dan bukan teks.
7. **Sian `--cyan`** hanya untuk isian kecil (chip, indikator "hidup", cincin fokus). Teks sian memakai `--cyan-text`.
8. **Hijau/merah** hanya sesuai §2.4.
9. Maksimal **tiga warna aksen** pada satu layar kecuali layar publik.
10. **Sidebar putih**, dipisah dari halaman biru pucat oleh garis `--border` dan bayangan kartu; item aktif memakai `--nav-active` + penanda oranye 3 px + teks `--blue-text`. Oranye hanya aksen kecil (penanda, lambang, badge 3), tidak pernah tombol.
11. **Kedalaman** dibuat dengan putih di atas biru pucat plus bayangan biru halus (§5), bukan dengan bayangan abu atau hitam.

## 4. Tipografi

Dua keluarga, keduanya gratis (Google Fonts). Berbeda dari IT FEST (Space Grotesk). Keduanya sudah terpasang dan terverifikan di file Figma.

| Peran | Font | Catatan |
|-------|------|---------|
| Judul, angka besar | **Sora** (600–700) | Karakter geometris, tegas di layar jauh |
| Isi, label, tabel | **Plus Jakarta Sans** (400–600) | Terbaca di ukuran kecil |

Angka uang memakai `font-variant-numeric: tabular-nums` agar kolom rapi. **Belum diverifikasi** bahwa kedua font menyediakan fitur `tnum`; uji dulu dan, jika tidak ada, pakai font lain untuk angka. Muat font dengan `next/font` agar tidak ada kedipan.

| Tingkat | Ukuran | Berat | Pemakaian |
|---------|--------|-------|-----------|
| Display | 56–72 px | 700 | Angka Total di layar publik |
| H1 | 32 px (laptop 40) | 700 | Judul halaman |
| Angka hero | 40 px (laptop 48) | 700 | Total di kartu hero |
| H2 | 24 px | 600 | Judul kartu |
| Isi | 18 px | 400 | Layar tim (laptop) |
| Isi kecil | 16 px | 400–500 | Layar penjaga, keterangan |
| Eyebrow | 13 px, huruf kapital, jarak huruf 0,12 em | 600 | Label di atas judul (`--blue-text`) |
| Keterangan | 14 px | 400 | Waktu, lokasi (`--text-muted`) |

Tinggi baris 1,4–1,5 untuk isi; 1,1–1,2 untuk judul. Jangan di bawah 14 px kecuali eyebrow.

## 5. Bentuk, jarak, dan kedalaman

| Token | Nilai |
|-------|-------|
| Radius kartu | 24 px |
| Radius ubin dan tombol | 16 px |
| Radius pil dan toggle | penuh (9999 px) |
| Jarak dasar | kelipatan 4 px; padding halaman 18 px (sempit), 32 px (laptop) |
| Jarak antar kartu | 16 px |
| Garis tepi | 1 px `--border` |
| Bayangan | Hanya biru transparan, tidak pernah abu atau hitam. Kartu: `0 2px 12px rgba(13,43,227,0.06)`. Dialog, lembar form, hero: `0 8px 32px rgba(13,43,227,0.16)` |
| Target sentuh | ≥ 44 × 44 px (penjaga ≥ 56 px untuk tombol Kirim) |
| Cincin fokus | 3 px `--blue-text` dengan jarak 2 px dari elemen (di sidebar: `--cyan`) |

## 6. Komponen

Nama mengikuti [07-ui-ux §7](07-ui-ux.md#7-komponen-bersama).

| Komponen | Rupa |
|----------|------|
| **AppShell tim dan admin (laptop)** | Sidebar putih (`--sidebar`) di kiri dengan garis kanan `--border` (logo + nama acara, menu, kartu akun di dasar). **Tidak ada bilah atas** (tim dan admin). Tim: tombol Selesai di kartu akun. Admin: tombol **Keluar** di kartu akun dan baris status koneksi (titik `--cyan-text` + "Terhubung") di antara identitas dan tombol. Area isi memakai `--page` |
| **AppShell penjaga (ponsel)** | Bilah atas putih (`--sidebar`, garis bawah `--border`) dengan tombol menu (`--sidebar-card`) + logo + nama acara, laci putih di kiri |
| **Laci / sidebar** | Latar `--sidebar`; item terpilih `--nav-active` dengan penanda 3 px `--accent` (oranye) di tepi kiri, ikon dan teks `--blue-text`; item biasa ikon dan teks `--text-muted`, nama aktif tim `--text` |
| **Kartu akun (dasar sidebar)** | Latar `--sidebar-card`, garis `--border`, padding 14. Baris identitas: ubin inisial `--bg-3` (huruf `--text`), nama tim `--text`, peran `--text-muted`. Di bawahnya tombol **Selesai** (admin: **Keluar**) selebar kartu: tombol sekunder (garis 2 px `--blue-text`, ikon keluar + teks `--blue-text`), tinggi 44, di tengah |
| **Banner sesi hampir habis (tim)** | Strip selebar area isi di **paling atas**, latar `--accent-2`, teks `--text-on-accent` (13,20). Kiri: ikon jam, judul "Sesi segera berakhir" (tebal) + "Sentuh layar untuk melanjutkan."; kanan: pil putih berisi hitung mundur "Keluar dalam 0:30" (SF Pro Bold, `--text`). Hanya di 30 detik terakhir; hitung mundur berkedip (dimatikan bila `prefers-reduced-motion`). Setiap sentuhan menutupnya dan mengatur ulang sesi 5 menit |
| **PageHeader** | Eyebrow `--blue-text`; judul `--text`; subjudul `--text-muted`; chip berlatar `--bg-1` bergaris `--border` |
| **Kartu panel** | `--bg-1` putih, radius 24, garis `--border`, bayangan kartu, padding 24 |
| **HeroBalanceCard** | Gradasi `--hero` (biru `#2A5FE6 → #0D2BE3`); **semua teks `--on-primary` putih** (kontras ≥ 5,4 di ujung terang, 8,5 di ujung gelap); bayangan `0 8px 32px rgba(13,43,227,0.28)`; angka Total memakai Angka hero; Saldo dan Nilai aset di bawahnya; tombol mata di kanan atas berlatar putih 20 %, ikon putih. **Tidak ada tombol Ke Pasar** |
| **Kartu Berita (Beranda)** | Kartu panel **di bawah** kartu hero, selebar penuh. Eyebrow `TETAP TERHUBUNG`, judul Berita, baris berita (ubin ikon `--bg-3`, judul + lencana Baru isian `--cyan` teks `--text-on-accent`, isi dua baris, waktu, ›) |
| **AssetCard (Pasar)** | `--bg-1` putih bergaris `--border`. Baris atas: ubin inisial 44 px `--blue` (huruf putih, tebal), nama aset `--text` (boleh dua baris), **chip perubahan** di kanan (§3.3). Lalu harga SF Pro Bold 26 px `--text`; titik stok `--cyan` (aman) atau `--accent` (rendah) + "stok 10 · punya 3" (`--text-muted`); tombol **Beli** `--primary` lebar penuh |
| **ListRow** | Tanpa latar sendiri di dalam kartu; pemisah `--border`; saat disentuh `--bg-2`; ubin kiri 48 px `--bg-3` |
| **Ubin nomor pos** | `--bg-3`, nomor `--text` |
| **StatusPill** | Isian `--ok` atau `--bad` pada 16 %, garis dan teks `--ok-text`/`--bad-text`, titik berwarna di kiri |
| **PostToggle (penjaga)** | Lebar 72 × tinggi 40; trek `--ok` (tersedia, bulatan di kanan) atau `--bad` (tutup, bulatan di kiri); bulatan **putih** `#FFFFFF`. Tanpa tulisan; `aria-label` menyatakan status |
| **Tombol utama** | Isian `--primary`, teks `--on-primary`, tebal 600, radius 16; saat ditekan `--primary-hover` `#0A21B4`. Dipakai untuk Beli, Kirim, Konfirmasi, Simpan koreksi, Tutup/Buka pasar, Unduh hasil akhir. Tombol nonaktif (hanya Unduh hasil akhir): `--primary` 45 % |
| **Tombol sekunder** | Garis 2 px `--blue-text`, teks `--blue-text`, latar putih/transparan |
| **Kolom isian** | Latar `--bg-0`, garis `--border-strong`, garis `--blue-text` saat fokus, teks `--text`, placeholder `--text-dim` |
| **Tooltip harga peringkat (Beranda)** | Pemicu: ikon info 14 px (lingkaran + "i", putih 90 %) di samping label NILAI ASET pada kartu hero; saat disentuh atau difokus muncul sorotan lingkaran putih 22 % 24 px. Isi: kartu `--bg-1` putih, 344 px, padding 16/14, radius 10, garis `--border`, bayangan dialog biru; judul "Harga peringkat" (SF Pro Semibold 13, `--text`) dan isi 12,5 px (`--text-muted`): "Nilai aset dihitung dari rata-rata harga transaksi 10 menit terakhir, bukan harga terakhir. Peringkat memakai angka ini, jadi satu transaksi kecil tidak langsung menggeser nilai." Diletakkan di area kosong kanan angka, panah kiri menunjuk ikon, garis tipis putih 55 % menghubungkan. Jangan menutup angka Saldo, Nilai aset, atau Total. Figma: `Tim — Beranda (tooltip harga peringkat)` |
| **Dialog beli** | `--bg-1` putih, radius 24, bayangan dialog, di atas `--overlay`; tombol Konfirmasi `--primary`, Batal sekunder; galat inline `--bad-text` dengan ikon |
| **Lembar form nominal (penjaga)** | Muncul **di halaman yang sama** dengan layar pindai: lembar dari bawah, `--bg-1`, radius atas 24, pegangan `--border-strong`, di atas `--overlay`. Isi berurutan: eyebrow `TIM TERBACA` (`--blue-text`), nama tim (SF Pro Bold 24), **kotak Saldo tim saat ini** (latar `--bg-2`, label `--text-muted` 12 px, angka SF Pro Bold 28 px `--text`), label Nominal, kolom nominal (garis `--blue-text`), tombol **Kirim Rp …** `--primary`, tombol Batal sekunder |
| **Toast** | `--bg-1` putih dengan bayangan dialog dan garis kiri 4 px (`--ok` sukses, `--bad` gagal, `--cyan` info); galat penjaga tetap tampil sampai ditutup |
| **EmptyState** | Ikon garis `--blue-text`, judul `--text`, keterangan `--text-muted` |
| **Layar publik (papan peringkat)** | Dua kolom terpisah dengan jarak 24 px: **kolom badge tetap** (badge 96 px) dan **daftar tim** (kartu `--bg-1` selebar sisa layar: nama tim di kiri; Total, Saldo, Nilai aset berjajar; angka Display `--text`, label `--text-muted`). Badge: 1 `--accent-2`, 2 `--blue-light`, 3 `--accent`, **4 dan 5 abu `#99A1B3`**; angka badge `--text-on-accent`. Hanya kartu tim yang bergeser saat peringkat berubah; badge tidak ikut bergerak. Kontras tinggi untuk proyektor: angka ≥ 56 px, `--text` murni |
| **Layar `/kiosk`** | Latar `--page`; bingkai pratinjau kamera garis `--blue-text` 3 px; teks "Scan QR untuk trading" SF Pro Bold 40 px `--text` |
| **Tabel admin** | Di dalam kartu panel `--bg-1` (radius 24). Kepala kolom 12 px SemiBold `--text-muted` huruf kapital; baris dipisah garis bawah 1 px `--border`, jarak antarkolom 12 px, tinggi baris ±56 px. Kolom angka rata kanan (SF Pro Semibold); satu kolom teks utama selebar sisa (FILL), kolom lain lebar tetap yang jumlahnya tidak melebihi lebar dalam kartu (±1068 px). Teks sel wajib bisa membungkus per kata. Kode aset memakai `--blue-text` |
| **Pil aksi (audit)** | Isian warna aksi 16 %, teks varian gelapnya, 13 px SemiBold, radius 8: `payout_awarded` `--cyan-text`, `adjust_cash` `--accent-text`, `set_price` `--blue-text`, `set_state`/`set_post_open` `--blue-text`, `rotate_team_qr` `--bad-text` |
| **Chip filter** | Radius penuh, 14 px SemiBold; aktif: isian `--bg-3` + garis `--blue-text` + teks `--text`; tidak aktif: garis `--border-strong` + teks `--text-muted` |
| **Dialog admin (Koreksi saldo)** | Lebar 520, `--bg-1`, radius 24, garis `--border`, di atas `--overlay`. Isi: eyebrow `KOREKSI SALDO` (`--blue-text`), nama tim (SF Pro Bold 26), saldo sekarang, kolom Selisih dan Alasan (wajib), kotak **Saldo sesudah** (`--bg-2`, angka `--text`), catatan audit, tombol Batal (sekunder) dan Simpan koreksi (`--primary`) |
| **Banner peringatan** | Isian `--accent-2` 25 %, garis `--accent-2`, ikon ⚠ dan teks `--text` 15 px; dipakai di Ekspor |
| **Kerangka (skeleton)** | Blok `--bg-2` dengan kilau `--bg-3` |

## 7. Mencegah kilatan gelap dan latar hitam yang tidak sengaja

- `html, body { background: var(--page); color: var(--text); color-scheme: light; }` dan `<meta name="theme-color" content="#F3F6FF">` supaya tidak ada kilat gelap saat memuat. Atur juga `<meta name="color-scheme" content="light">`. Jangan membaca `prefers-color-scheme`: aplikasi hanya light.
- `app/loading.tsx` dan `app/not-found.tsx` memakai latar yang sama.
- Isian otomatis browser: `input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px var(--bg-0) inset; -webkit-text-fill-color: var(--text); }` (browser memberi latar kuning pucat bila tidak ditimpa).
- Bilah gulir dan seleksi teks: `scrollbar-color: var(--bg-3) var(--page)`; `::selection { background: var(--bg-3); color: var(--text); }`.
- Dropdown/`select` native memakai `color-scheme: light`; lebih baik komponen sendiri berlatar `--bg-1`.
- Jangan memakai `rgba(0,0,0,…)`, `black`, `#000`, atau hex dengan kecerahan sangat rendah sebagai latar, bayangan, atau overlay. Overlay memakai `--overlay`, bayangan memakai biru transparan (§5). Pemeriksaan di CI: tolak latar dengan luminans relatif < 0,06. Putih tidak lagi dilarang.
- Layar `/display` dan `/kiosk` ikut terang. Untuk proyektor: kecerahan layar penuh membuat latar putih silau, jadi pakai `--page` (bukan putih murni) sebagai latar layar dan simpan putih untuk kartu.
- **Kartu QR cetak.** Area QR harus terang dengan modul gelap agar terbaca kamera. Pada mode light ini tidak lagi pengecualian: pakai `--bg-1` putih dengan modul `#03071E` (kontras ≥ 15), margin tenang ≥ 4 modul. Verifikasi keterbacaan dengan kamera laptop sebelum mencetak banyak.

## 8. Pembeda dari IT FEST

Situs IT FEST memakai latar biru royal gelap-terang, aksen lime, judul Space Grotesk. **Classmeet kini terang**, jadi kemiripan latar berkurang; yang tetap menautkan identitas adalah biru royal pada tombol utama dan tautan. Pembedanya: halaman terang, aksen **oranye** (bukan lime), warna sekunder sian dan kuning dari maskot, judul SF Pro Bold + isi Plus Jakarta Sans, hero **gradasi api**, dan logo sendiri. Struktur halaman meniru IT FEST ([07 §0](07-ui-ux.md#0-kerangka-layout-bersama-acuan-it-fest)). Logo IT FEST tidak dipakai; logo, nama, dan teks tetap milik Classmeet.

Maskot memuat logo "Techno Fair 26" di dadanya. **Jangan memakai gambar maskot utuh di website** tanpa menghapus atau memastikan hak pakai logo itu; dokumen ini hanya mengambil warnanya, sesuai keputusanmu.

## 9. Implementasi

```css
/* app/globals.css */
:root {
  color-scheme: light;
  --page: #F3F6FF;
  --bg-0: #F3F6FF;  --bg-1: #FFFFFF;  --bg-2: #EAF0FF;  --bg-3: #D6E0FF;
  --sidebar: #FFFFFF;  --sidebar-card: #EAF0FF;  --nav-active: #EAF0FF;
  --border: #D3DCF7;  --border-strong: #8E9CD6;
  --overlay: rgba(10, 33, 180, 0.55);

  --text: #0B1437;  --text-muted: #434D7E;  --text-dim: #5C6694;
  --text-on-accent: #03071E;   /* hanya teks, bukan latar */
  --primary: #0D2BE3;  --primary-hover: #0A21B4;  --on-primary: #FFFFFF;

  --accent: #FA9F1F;  --accent-text: #A35500;  --accent-2: #FBCD3A;
  --blue: #2A5FE6;    --blue-text: #2A55D6;    --link: #0D2BE3;  --blue-light: #82AFF9;
  --cyan: #25EEEF;    --cyan-text: #00717A;
  --hero: linear-gradient(135deg, #2A5FE6 0%, #0D2BE3 100%);

  /* pengecualian semantik, hanya §2.4 */
  --ok: #34D399;  --ok-text: #09704A;
  --bad: #F87171; --bad-text: #C0262D;

  --rank-gray: #99A1B3;   /* badge peringkat 4 dan 5 */

  --radius-card: 24px;  --radius-tile: 16px;
  --shadow-card: 0 2px 12px rgba(13, 43, 227, 0.06);
  --shadow-dialog: 0 8px 32px rgba(13, 43, 227, 0.16);
}
html, body { background: var(--page); color: var(--text); }
```

```ts
// tailwind.config.ts (Tailwind v3; pada v4 pindahkan ke @theme di CSS)
export default {
  theme: { extend: { colors: {
    page: "var(--page)", sidebar: { DEFAULT: "var(--sidebar)", card: "var(--sidebar-card)" },
    bg: { 0: "var(--bg-0)", 1: "var(--bg-1)", 2: "var(--bg-2)", 3: "var(--bg-3)" },
    ink: { DEFAULT: "var(--text)", muted: "var(--text-muted)", dim: "var(--text-dim)", onAccent: "var(--text-on-accent)",
           onPrimary: "var(--on-primary)" },
    primary: { DEFAULT: "var(--primary)", hover: "var(--primary-hover)" },
    accent: { DEFAULT: "var(--accent)", text: "var(--accent-text)", 2: "var(--accent-2)" },
    brand: { blue: "var(--blue)", text: "var(--blue-text)", link: "var(--link)", light: "var(--blue-light)", cyan: "var(--cyan)", cyanText: "var(--cyan-text)" },
    ok: { DEFAULT: "var(--ok)", text: "var(--ok-text)" }, bad: { DEFAULT: "var(--bad)", text: "var(--bad-text)" },
  }, borderRadius: { card: "24px", tile: "16px" },
     boxShadow: { card: "var(--shadow-card)", dialog: "var(--shadow-dialog)" } } },
};
```

Aturan kode: **dilarang** `bg-black`, `#000`, `black`, dan `rgba(0,0,0,…)` sebagai latar, bayangan, atau overlay; dilarang memakai `--accent`, `--accent-2`, `--cyan`, `--blue-light` sebagai **warna teks** di atas latar terang (pakai varian `-text`). Tambahkan aturan lint (mis. `no-restricted-syntax` atau pemeriksaan `grep` di CI) untuk keduanya.

Di Figma, token ini ada sebagai variabel koleksi **"Classmeet / warna"** (`page`, `bg/0…3`, `chrome` (kini putih, nama dipertahankan di Figma untuk sidebar), `chrome-2`, `nav-active`, `primary`, `on-primary`, `border`, `text/*`, `accent`, `accent-2`, `blue`, `blue-light`, `cyan`, `ok`, `bad` dan varian `-text`). Namanya diubah ke bentuk CSS di atas saat implementasi.

## 10. Daftar periksa desain

- [ ] Tidak ada latar hitam atau hampir hitam: periksa kartu, dialog, isian, tabel, toast, overlay, halaman 404/loading, dan kilat saat muat ulang.
- [ ] Semua teks isi memenuhi ≥ 4,5 : 1 menurut tabel §2.5; teks besar ≥ 3 : 1. Tidak ada teks oranye/kuning/sian/biru muda terang di atas latar terang.
- [ ] Naik/turun, status pos, dan hadiah masuk/keluar terbaca tanpa warna (ikon + teks/tanda).
- [ ] Toggle pos terbaca di bawah sinar matahari dan tanpa warna (posisi bulatan berbeda).
- [ ] Hanya satu tombol `--primary` per layar kecuali daftar aset.
- [ ] Kartu hero terbaca dari jarak laptop (teks putih di atas gradasi biru).
- [ ] Sidebar putih terpisah jelas dari halaman `--page` (garis `--border` terlihat) dan oranye tidak muncul sebagai tombol.
- [ ] Layar publik terbaca dari jarak jauh di proyektor (angka ≥ 56 px) dan tidak silau; badge peringkat tetap di tempat saat kartu bergeser.
- [ ] Font `tnum` diuji; angka rupiah rata di kolom.
- [ ] Hijau/merah tidak muncul di luar §2.4.
- [ ] Uji pada laptop sekolah sungguhan (kecerahan dan profil warna layar bisa menggeser tampilan; `--page` `#F3F6FF` bisa tampak sama dengan putih di panel murah, jadi cek kartu putih masih terpisah dari halaman).

## 11. Belum diputuskan

- Logo dan nama resmi di sidebar (maskot memuat logo pihak lain; lihat §8).
- Ilustrasi keadaan kosong dan ikon: sementara ikon garis sederhana; maskot tidak dipakai.
- Jenis huruf final setelah uji `tnum` dan keterbacaan di laptop sekolah.
- Interaksi prototipe Figma belum dibuat; sidebar dibuat per layar, bukan komponen.
- Garis isian: `--border-strong` (2,5:1) atau `#6F7FC4` (≈3,9:1) bila ingin lolos WCAG 1.4.11 penuh.
