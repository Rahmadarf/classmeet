# 21. Kumpulan 650 berita tulis tangan (format markdown)

Menggantikan pembuat berita otomatis ([15](15-mesin-berita-v2.md) §3, [14](14-kumpulan-berita.md)) dengan berita yang ditulis dan ditentukan efeknya satu per satu. Mesin **pemilihan** ([15](15-mesin-berita-v2.md) §2) tidak berubah. Gaya bahasa: [20](20-gaya-bahasa-berita.md). Isi berita ada di folder [`berita-650/`](berita-650/); dokumen ini ringkasan, format, dan catatan.

**Status (25 Nov):** efek sudah dikalikan 1,5; pemuat markdown sudah ada (§7) dan `scripts/data/news-pool.json` sudah dibangun darinya (650 berita). Belum dimuat ke database permainan (`npm run load-news -- --replace`). Teks fiksi.

## 1. Isi

| Berkas | Isi | ID |
|--------|-----|----|
| `berita-01.md` | energi dan komoditas | H001–H047 |
| `berita-02.md` | pangan, pertanian, cuaca | H048–H094 |
| `berita-03.md` | moneter, makro, fiskal, perdagangan | H095–H141 |
| `berita-04.md` | perbankan dan pembayaran | H142–H188 |
| `berita-05.md` | teknologi dan telekomunikasi | H189–H235 |
| `berita-06.md` | penerbangan, otomotif, transportasi daring | H236–H282 |
| `berita-07.md` | kesehatan, perawatan pribadi, konsumen | H283–H329 |
| `berita-08.md` | politik, kebijakan, bencana, geopolitik | H330–H376 |
| `berita-09.md` | konsumen, ritel, wisata, koreksi sektoral | H377–H423 |
| `berita-10.md` | campuran, samar, koreksi sektoral | H424–H470 |
| `berita-11.md` | 30 bangkrut (B001–B030) dan 30 suspensi (S001–S030) | B, S |
| `berita-12.md` | 30 suspensi (S031–S060) dan 30 dividen (D001–D030) | S, D |
| `berita-13.md` | 60 dividen (D031–D090) | D |

Total **650**: 470 harga (H), 30 bangkrut (B), 60 suspensi (S), 90 dividen (D). Tiap aset punya tepat 1 bangkrut, 2 suspensi, 3 dividen (urutan aset: AP MI SA XI TE NE KH DA MA IN BC VI MD BR PA AI TO HO GR GA LO PF UN KA SM CV SL PE PN AD).

## 2. Format satu berita

```
### H001 · Judul
Paragraf isi (1–3 paragraf, dipisah baris kosong)

**Efek:** CV +10.8 · GA -11.2 · ...        (persen perubahan harga acuan; × 100 = bps)
**Event:** Bangkrut — AP (sisa harga 10%)   (hanya berita event)
```

Pemetaan ke skema `news-pool.json` (bila nanti dimuat): `kind` price/bankrupt/suspend/dividend; `effects[].pct_bps` = persen × 100; `event.amount` = 1000 (bangkrut), menit (suspensi), persen × 100 (dividen: 0.5 % → 50). Bidang `analysis` tidak ditulis; dibangkitkan kode dari efek dan kamus sifat ([16](16-sifat-aset.md), [18](18-analisa-pasar.md)).

Aturan yang dipenuhi (diperiksa skrip di luar repo): 10–15 aset per berita; efek maks ±15 %; aset bangkrut tidak punya efek di berita bangkrutnya; subjek suspensi turun dan subjek dividen naik; berita harga tidak menyebut nama perusahaan; berita event tidak menyebut nama aset lain.

## 3. Kalibrasi

- **Besar efek (25 Nov, setelah pengali ×1,5):** semua efek ≥ 1 % dikalikan 1,5 (maks 15 %; pengisi < 1 % tidak diubah) sesuai hasil simulasi di §6. Rata-rata efek berarti 6,8 % (acuan [19](19-kalibrasi-ekonomi.md): 5,7 %); efek terbesar per berita harga rata-rata 11,9 % (acuan 8,1 %). Sebaran efek berarti: > 8 % 34 %, 4–8 % 32 %, 1–4 % 34 %. Efek tepat 15 % ada 5,0 % (118 efek); lebih tinggi daripada acuan docs/19 untuk ×2,5 (2,7 %), jadi perlu dipantau di mesin sungguhan.
- **Pengisi:** efek < 1 % ditambahkan sampai jumlah aset per berita tersebar 10–15 (10: 106, 11: 151, 12: 134, 13: 93, 14: 91, 15: 75).
- **Saldo per aset** (jumlah semua efek di seluruh kumpulan, persen) dijaga mendekati nol: semua aset di antara −9 dan +31 setelah pengali ×1,5 (sebelum pengali −3 sampai +8; tertinggi SL +31, SM +30, TO +25, KA +22). Cara: sebagian efek kecil yang tidak terpetunjuk dibalik tandanya, sebagian efek positif atau negatif aset tertentu (SL, SM, KA, IN) dikecilkan secara seragam, dan pengisi dipilih melawan saldo berjalan.
- **Penggerak utama** (|efek| ≥ 4 %) per aset berkisar 28–81 kali setelah pengali ×1,5 (naik/turun seimbang).

## 4. Yang tidak sempurna (jujur)

1. **Pola bahasa belum sepenuhnya hilang.** Paragraf kedua sering memakai urutan "sektor A menguat, sektor B melemah, satu kalimat pengecoh". Jumlah paragraf: 1 paragraf 118 berita, 2 paragraf 522, 3 paragraf 10. Kalimat pembuka dividen dan frasa sisa bangkrut diacak, tetapi pola "membagikan dividen sekitar … % dari harga saham" tetap ada karena itu informasi. Pengecoh sifat hanya ada di sekitar 27 % berita (kamus kata kunci). Penyuntingan manusia masih disarankan.
2. **Pembalikan tanda otomatis (± 760 efek kecil)** memakai deteksi kata kunci; efek yang disebut dengan parafrasa yang tidak ada di kamus bisa ikut terbalik. Dugaan terbanyak jatuh pada efek 1–2,6 %. Perlu pemeriksaan sampel sebelum dimuat.
3. **Simulasi mesin pemilihan sudah jalan** (§7); simulasi strategi (§6) memakai salinan di luar repo dan belum diulang dengan mesin sungguhan.
4. **Petunjuk tidak dijaga mesin.** `validatePool` mode tulis tangan tidak menuntut frasa kamus sifat; 39 berita tidak memuat kata kunci sifat aset berefek besar sama sekali (peringatan dari pemuat, §7) dan perlu ditinjau manusia.
5. Berita harga tidak disusun menurut urutan terbit; mesin yang memilih. Tidak ada berita yang merujuk berita lain.

## 5. Langkah berikutnya

1. Tinjau 39 peringatan petunjuk dan penyuntingan akhir isi oleh manusia (pola kalimat, pengecoh).
2. Muat ke database saat game `setup`: `npm run load-news -- --replace`.
3. Atur harga Analisa Rp 50.000–75.000 dan jalankan ulang simulasi strategi dengan mesin sungguhan bila perlu.

## 6. Hasil simulasi (25 Nov)

Dijalankan lewat salinan `sim-strategy.ts` di luar repo yang membaca kumpulan ini (kode repo tidak diubah). Parameter seperti [19](19-kalibrasi-ekonomi.md): 3 hari, 20 benih, modal Rp 5 juta, selisih jual 2 %, 15 % giliran event. Pilihan berita seragam (mesin sungguhan memilih menurut kondisi pasar). Pembaca petunjuk diasumsikan membaca aset dengan efek naik terbesar dan turun terbesar, padahal petunjuk tulis tangan tidak selalu menyebut keduanya; hasilnya perkiraan atas.

**Strategi (laba 3 hari, selisih jual 2 %), perbandingan dengan kumpulan lama (effectScale 2):**

| Pengali efek di simulator | Pembaca petunjuk | Analisa Rp 100.000 | Analisa Rp 75.000 | Analisa Rp 50.000 | Acak |
|---------------------------|------------------|--------------------|-------------------|-------------------|------|
| ×1,0 (apa adanya) | +10,9 % | −29,6 % | – | – | −25,0 % |
| ×1,5 | **+23,5 %** | −3,6 % | +12,2 % | +28,1 % | −25,0 % |
| ×1,8 | +28,6 % | +8,5 % | +26,0 % | – | −24,9 % |
| ×2,0 | +29,7 % | +16,9 % | +33,1 % | – | −24,8 % |
| Kumpulan lama (×1) | +23,1 % | +18,2 % | – | – | −25,5 % |

- Pada selisih jual 3 %, ×1,0 hanya +3,7 % (hampir impas), ×1,5 +15,5 %; kumpulan lama +16,7 %.
- **Efek apa adanya terlalu lemah:** rata-rata efek berarti 4,6 % (lama 5,7 %) dan banyak efek berarti hanya 1–3 %, sehingga pembaca petunjuk hanya menang 70 % per transaksi (lama 84 %) dan Analisa Rp 100.000 tidak terbayar.
- **Pengali ×1,5 menyamai kumpulan lama bagi pembaca petunjuk (+23,5 % vs +23,1 %).** Dengan ×1,5, harga Analisa yang masuk akal turun menjadi Rp 50.000–75.000 (Rp 100.000 impas). Pengali ×1,8 sampai ×2,0 membuat Analisa Rp 100.000 layak lagi, tetapi lihat kesehatan harga di bawah.

**Kesehatan harga** (50 game × 220 berita, tanpa mesin pemilihan, tanpa transaksi; efek dikalikan pengali):

| Pengali | Simpangan baku perubahan akhir | Aset berakhir di batas 30 % / 300 % | Rata-rata perubahan akhir |
|---------|--------------------------------|------------------------------------|---------------------------|
| ×1,0 | 30 % | 0,0 % | −2,3 % |
| ×1,5 | 43 % | 0,3 % | −2,9 % |
| ×1,8 | 49 % | 0,5 % | −2,8 % |
| ×2,0 | 52 % | 0,9 % | −3,0 % |

Pilihan seragam tanpa penahan lebih buruk daripada mesin sungguhan (docs/15 §4: suhu 5000 yang hampir acak menaikkan simpangan baku dari 0,13–0,16 menjadi 0,15–0,18, dan mesin lama menahan sampai 0,28 pada ×2). Selama simulasi, beberapa aset sempat menyentuh batas 300 % / 30 % sementara pada ×1,0 ke atas, tetapi hampir semuanya berakhir di dalam batas. Aset dengan rata-rata akhir terendah: NE −17 %, IN −10 %, MA −9 % (pada ×1,0); tertinggi: PN +12 %, GA +7 %. Bias per aset ini lebih kecil dari simpangan baku tetapi tetap ada karena saldo efek diseimbangkan, bukan peluang pilihan.

**Tindak lanjut:** pengali ×1,5 sudah diterapkan di berkas data (tabel di atas memakai efek sebelum pengali, jadi baris ×1,5 setara berkas sekarang). Atur harga Analisa Rp 50.000–75.000, lalu jalankan `sim-news-engine.sh` setelah dimuat.

## 7. Pemuat dan simulasi mesin (25 Nov)

**Kode baru/diubah:**

| Berkas | Isi |
|--------|-----|
| `scripts/news-hand-lib.ts` | parse markdown → `PoolNews` (persen → bps; bangkrut `sisa harga X%` → bps likuidasi; suspensi menit; dividen persen × 100), pengali efek, `decoysInText`, `handHintWarnings` |
| `scripts/build-news-from-markdown.ts` | `npm run build-news` (`--check`, `--sql`, `--replace`, `--scale`, `--out`, `--dir`): baca `docs/berita-650/berita-*.md`, bangkitkan `analysis`, validasi, tulis `scripts/data/news-pool.json` dan SQL |
| `scripts/news-pool-lib.ts` | `analysisParagraphs` menerima pengecoh dari teks asli; `validatePool(..., { hand: true })` (isi boleh satu paragraf, tanpa tuntutan frasa kamus persis) |
| `scripts/load-news-pool.sh`, `sim-news-engine.sh` | memakai pemuat markdown (argumen `skala_efek` kini pengali atas berkas, bawaan 1) |
| `scripts/generate-news-pool.ts` | pembuat lama menulis ke `news-pool.auto.json` supaya tidak menimpa `news-pool.json` |
| `scripts/news-hand-lib.test.ts`, `seed-lib.test.ts` | tes baru (parse, pengali, analisa, kumpulan 650) dan jumlah berita 1100 → 650 |

`bangkrut` memakai `liquidation_bps` = 1000; dividen 30–150 bps (batas DB 10–1000); suspensi 10–20 menit (batas DB 1–30).

**Simulasi mesin pemilihan** (`scripts/sim-news-engine.sh 3 80 <benih> 100`, di dalam transaksi ROLLBACK, kumpulan lama diganti sementara; 3 hari, suhu 80):

| Ukuran | Hasil (3 benih) | Acuan docs/15 §4 |
|--------|-----------------|------------------|
| Berita terbit per game | 214–225 | ±220 |
| Berita event / semua | 13–16 % | 14–17 % |
| Bangkrut per game | 1–3 | kecil, maks. 4 |
| Event paling awal sesudah pasar dibuka | 30–187 menit | ≥ 30 |
| Aset di batas harga pada akhir | 0 dari 27–30 | sedikit |
| Simpangan baku perubahan akhir | 0,19–0,39 | 0,13–0,28 |
| Rentang akhir | −0,55 s.d. +1,38 | −41 % s.d. +91 % (docs/19) |
| Sisa berita harga | 276 dari 470 | tidak habis |

Ekornya lebih lebar dari kumpulan lama pada satu benih (+138 %), karena efek ×1,5 dan 5 % efek tepat 15 %. Bila terlalu liar saat latihan, turunkan lewat `npm run build-news -- --scale 0.85`.

**Tes:** `vitest run scripts/news-hand-lib.test.ts scripts/seed-lib.test.ts scripts/news-pool-lib.test.ts` lulus.
