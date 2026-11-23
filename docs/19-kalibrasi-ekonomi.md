# 19. Kalibrasi ekonomi: besar efek berita vs selisih jual

Latar (23 Nov): koreksi dari luar menyebut efek berita terlalu kecil dibanding selisih jual 2 % dan hasilnya terlalu sensitif terhadap parameter. Dihitung ulang dengan simulator strategi; hasilnya mengubah pengali besar efek di pembuat berita dan memberi patokan harga Analisa Pasar.

## 1. Temuan sebelum kalibrasi

Kumpulan lama (`effectScale` 1,0): rata-rata efek semua aset 1,79 %; efek berarti (≥ 1 %) rata-rata 2,87 %; efek terbesar per berita rata-rata 4,07 %. **Hanya 33 % efek melampaui selisih jual 2 %** (sisanya habis oleh selisih jual dan tekanan stok, sehingga petunjuk yang benar pun sering tidak menghasilkan untung). Mata uang yang dipertaruhkan pemain kecil, jadi hasil strategi tinggal sekitar +2 %:

| Strategi (3 hari) | Selisih jual 1,5 % | 2 % | 3 % |
|-------------------|-------------------|-----|-----|
| Pembaca petunjuk | +5,4 % | **+2,5 %** | **−3,4 %** |
| Acak | −20,7 % | −25,3 % | −34,5 % |

Arah temuan sama dengan koreksi: pada selisih 3 % pembaca berita rugi, dan keuntungan sangat bergantung pada pengaturan.

## 2. Simulator (`scripts/sim-strategy.ts`)

Satu tim memperdagangkan kumpulan berita sungguhan (`buildPool`) dengan rumus beli/jual sungguhan (`lib/market/rules.ts`: tekanan di dalam transaksi, selisih jual, batas pegang, stok) selama 3 hari pasar (11 jam per hari), jeda efek 3–15 menit, gap 0, 20 benih. Tidak menyentuh database.

- **Strategi:** *hint* (mengenali aset yang disebut berita; petunjuk tanpa arah ditebak benar dengan peluang 0,7; membeli yang dikira naik), *analisa* (membayar harga analisa hanya bila perkiraan laba melebihi harganya, tahu 3 aset naik terbesar beserta pita kekuatan), *acak* (satu aset acak tiap berita). Semua membeli saat berita terbit dan menjual begitu efek berlaku. Dua strategi pertama memilih jumlah yang memaksimalkan laba bersih yang diharapkan.
- **Asumsi:** modal awal Rp 5 juta + hadiah Rp 300.000 per 20 menit; hanya 20 % stok yang terjangkau satu tim (rebutan dengan tim lain); batas pegang 30 %; berita dipilih seragam dari kumpulan (mesin sungguhan memilih menurut kondisi pasar); 15 % giliran membawa event (hanya efek harganya dipakai); pembaca berita sempurna dalam mengenali frasa (batas atas kemampuan manusia).
- **Cara pakai:** `npx tsx scripts/sim-strategy.ts --grid --analysis 100000`; opsi `--gen` (pengali di pembuat berita), `--scale` (pengali di simulator), `--spread`, `--share`, `--hold`, dll.
- **Batas:** simulator bukan ramalan. Satu tim saja (persaingan hanya lewat `--share`), tidak ada kejutan event (dividen/suspensi/bangkrut), dan hasil bergantung pada asumsi kapasitas: bila satu tim boleh menguasai 100 % stok dengan batas pegang 70 %, tekanan harga milik sendiri membuat hasil sangat berbeda (pembaca lama rugi −36 %), sehingga angka "sensitif" dari koreksi (−24 % pada selisih 3 %, +97 % pada efek ×2) tidak ikut terulang persis; arahnya sama, besarnya ditentukan kapasitas.

## 3. Keputusan: `effectScale` = 2

`PoolConfig.effectScale` (bawaan 2,0) mengalikan efek bertema dan efek event (bukan efek pengisi ≤ 0,9 %, yang sengaja kecil), dibatasi 15 %. Kumpulan baru: efek berarti rata-rata 5,7 %, efek terbesar per berita 8,1 %; 19 % efek berarti > 8 % ("kuat"), 47 % 4–8 % ("sedang"), 34 % 1–4 % ("ringan"). Pilihan ini kembali mendekati pedoman awal docs/05 (efek 8–14 % pada aset yang dibidik).

| Strategi (3 hari, analisa Rp 100.000) | Selisih 1,5 % | **2 %** | 3 % |
|---------------------------------------|---------------|---------|-----|
| Pembaca petunjuk | +23,9 % | **+20,8 %** | +14,5 % |
| (peluang menang per transaksi) | 86 % | 84 % | 77 % |
| Pembeli analisa | +27,8 % | **+18,7 %** | +0,5 % |
| Acak | −20,9 % | −25,6 % | −34,9 % |

- Pembaca petunjuk kini untung jelas (p10 +14,6 %, p90 +28,2 %) dan tetap untung pada selisih 3 %; sensitivitas ±1 poin selisih ≈ ∓6 poin hasil (dulu hasil berbalik tanda). Efek ×0,75 dan ×1,25 di simulator: +11 % dan +26 %.
- Strategi acak tetap rugi besar (biaya selisih dan tekanan): bermain tanpa informasi dihukum, tetapi tidak menghapus modal (tanpa pembelian, saldo tetap).
- Kesehatan harga (simulasi mesin berita 3 hari, `scripts/sim-news-engine.sh`): tidak ada aset yang berakhir di batas harga (30 % atau 300 %); perubahan akhir −41 % sampai +91 %, simpangan baku 0,28 (dulu −18 % sampai +31 %). Pilihan ×2,5 dan ×3 menaikkan hasil tetapi menaikkan simpangan dan jumlah efek yang mentok di batas 15 % (2,7 % dan 6 %); ×2 hanya 0,3 %.

## 4. Harga Analisa Pasar

Dari simulasi ×2 (selisih 2 %), pembeli analisa yang rasional membeli bila laba perkiraannya melebihi harga: Rp 50.000 memberi +50,4 %, Rp 75.000 +34,5 %, **Rp 100.000 +18,7 %**, Rp 150.000 −11,2 % (membeli terlalu sering dengan harga itu merugi), dan di Rp 200.000 tidak ada yang membeli (0 %). Patokan: **Rp 75.000 sampai Rp 100.000** (awal Rp 100.000), kira-kira sepertiga sampai seperempat hadiah satu kunjungan pos. Pembaca manusia lebih lemah dari pembaca sempurna di simulator, jadi nilai analisa bagi mereka lebih tinggi; naikkan harga bila terlalu banyak tim membeli, turunkan bila tidak ada. Pada selisih jual 3 % harga Rp 100.000 hanya impas (+0,5 %), jadi harga dan selisih jual disetel bersama.

## 5. Yang perlu dilakukan setelah mengubah `effectScale`

1. `npm run generate-news` (mengganti `scripts/data/news-pool.json` dan `docs/14`), lalu muat ulang kumpulan ke database saat game `setup` (`npm run load-news -- --replace`).
2. Jalankan `scripts/sim-news-engine.sh 3 80 0.42 100` (kesehatan harga) dan `npx tsx scripts/sim-strategy.ts --grid` (keuntungan strategi).
3. Pita kekuatan di laporan analisa (`STRENGTH_BANDS`) mengikuti sebaran efek; sesuaikan bila skala berubah.
