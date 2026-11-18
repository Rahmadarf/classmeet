# 13. Perintah untuk Claude Code: implementasi aplikasi
 
Tempel seluruh isi di bawah garis ini sebagai pesan pertama di sesi Claude Code yang dibuka di folder `classmeet/` (induk dari `docs/`). Kerjakan per tahap; jangan biarkan ia lompat ke tahap berikutnya.
 
---
 
## Peran dan tujuan
 
Kamu membangun aplikasi web **Classmeet Market** (Next.js + Supabase) dari dokumen dan desain yang sudah matang. Basis datanya **sudah selesai dan teruji**: jangan menulis ulang logika bisnis di aplikasi. Tugasmu adalah antarmuka, alur sesi, dan sambungan ke RPC.
 
Urutan kerja **satu halaman per langkah**, dalam tiga tahap: **(A) Tim, (B) Display, (C) Admin**. Penjaga ditunda sampai aku minta. Setelah **setiap halaman** selesai, berhenti, laporkan singkat, dan tunggu aku menulis "lanjut". Jangan mengerjakan dua halaman sekaligus.
 
## Baca dulu (urut, jangan dilewati)
 
1. `docs/README.md`, `docs/01-overview.md`, `docs/05-game-rules.md` (aturan permainan).
2. `docs/02-architecture.md` (stack dan struktur folder), `docs/06-security.md`.
3. `docs/04-rpc-contracts.md` (kontrak RPC; **satu-satunya jalur tulis ke data permainan**), `docs/03-database.md`, `docs/12-order-book.md`.
4. `docs/07-ui-ux.md` (peta halaman, sketsa, status UI) dan `docs/DESIGN.md` (token, tipografi, komponen).
5. `docs/10-verification-report.md` (apa yang sudah dan belum teruji).
Bila dokumen bertentangan dengan pesan ini, **pesan ini menang**; catat pertentangannya di `docs/13-log-implementasi.md`.
 
## Lingkungan
 
- Supabase Cloud **staging**: project `classmeet-staging`, ref `sjqboaqkhykmzconskvn`, region ap-southeast-1. URL: `https://sjqboaqkhykmzconskvn.supabase.co`. Skema, RPC, dan `pg_cron` sudah terpasang (migrasi 01–06). Ambil kunci **publishable (anon)** dari dashboard atau lewat Supabase MCP bila tersedia. Tulis ke `.env.local` (jangan di-commit); sediakan `.env.example`.
- **Jangan pernah** memasukkan `service_role` ke aplikasi, ke `.env.local` milik aplikasi, atau ke log. Skrip panitia (`scripts/`) memakainya secara lokal saja, dan aku yang menyediakan kuncinya bila perlu.
- Basis data sudah punya skema tetapi **belum ada data uji**. Tahap 0 membuat data uji lewat skrip (lihat di bawah).
- Folder `docs/scripts/` berisi `import-news.ts`, `news-lib.ts`, `assets.example.json`, `news.example.json`; salin ke `scripts/` bila diperlukan.
## Desain Figma
 
- File: **BukuKu**, kunci `LeSiMlDeTw813UGPTp2aZw`, halaman **Desain Web**.
- Section **Rally Game** (berisi semua frame Classmeet): https://www.figma.com/design/LeSiMlDeTw813UGPTp2aZw/BukuKu?node-id=1079-47
- Halaman yang sama juga berisi frame proyek lain (`Fondasi Visual`, `Jong Batam — ...`). **Jangan disentuh dan jangan dijadikan acuan.** Hanya frame berawalan `Tim —`, `Admin —`, `Layar publik —`, `Penjaga —`, `Kiosk —`, dan `Komponen — Classmeet Market` yang relevan. Frame berawalan `ARSIP —` sudah tidak dipakai.
- Cara menemukan frame: panggil `get_metadata` pada node `1079:47` untuk daftar frame beserta ID-nya, atau cari berdasarkan nama di bawah. ID yang sudah diketahui (buka dengan `?node-id=` dan ganti `:` menjadi `-`):
| Frame | Node ID |
|-------|---------|
| Tim — Beranda | `1082:48` |
| Tim — Beranda (tooltip harga peringkat) *(di luar section, di halaman)* | `1133:286` |
| Tim — Pasar (order book) | `1082:164` |
| Tim — Pasar (pasar dijeda) *(di luar section)* | `1129:612` |
| Tim — Pasar (error isian) *(di luar section)* | `1129:935` |
| Tim — Pasar (Jual · Market) *(di luar section)* | `1129:1249` |
| Tim — Daftar Pos | `1083:589` |
| Tim — Portofolio | `1083:350` |
| Tim — Riwayat | `1083:459` |
| Tim — Sesi hampir habis | `1102:398` |
| Tim — Order terbuka | `1122:612` |
| Admin — Status game | `1085:324` |
 
- Seluruh teks di Figma memakai **SF Pro**; aplikasi tidak bisa memuatnya di web (lihat Tahap 0 butir 4), jadi tampilan nyata di Windows akan memakai Inter. Anggap Figma sebagai acuan bentuk, bukan ukuran huruf yang presisi.
- Radius: panel dan kartu 10, tombol/ubin/input 8, baris daftar 14, tab 12 (kontainer 16), chip dan pil bulat penuh.
- Halaman yang tidak ada di tabel dicari berdasarkan nama frame lewat `get_metadata`.
## Tahap 0: fondasi (kerjakan sekali, sebelum halaman pertama)
 
1. Buat proyek: `npx create-next-app@latest` di folder `classmeet/` yang sudah ada isinya (`docs/` jangan disentuh): TypeScript, App Router, **tanpa `src/`**, Tailwind (versi terbaru; token di `@theme`/CSS variable), ESLint. Struktur folder mengikuti `docs/02-architecture.md` §6.
2. Pasang: `@supabase/supabase-js @supabase/ssr zod lucide-react @yudiel/react-qr-scanner clsx tailwind-merge class-variance-authority @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-tooltip sonner`; dev: `supabase tsx prettier prettier-plugin-tailwindcss vitest`. **Jangan** pasang pustaka grafik, state manager, socket.io, atau pustaka animasi besar tanpa alasan tertulis. Sparkline dan grafik garis IKC digambar sendiri dengan SVG.
3. Token dari `docs/DESIGN.md` §2–§5 menjadi CSS variable (warna, radius 8/10/14/16/pil, bayangan biru). **Jangan ada permukaan hitam atau hampir hitam.** Kontras mengikuti angka di DESIGN.md.
4. **Font: SF Pro tidak boleh dimuat sebagai berkas web** (lisensi Apple). Pakai `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif`, dan muat **Inter** lewat `next/font` sebagai cadangan. Aktifkan `font-variant-numeric: tabular-nums` untuk semua angka uang. Uji kolom harga di order book pada Inter.
5. `lib/supabase/` (klien browser, klien server, middleware sesi + pengalihan per peran), `lib/money.ts` (rupiah bigint, format `Rp 1.250.000`, waktu WIB), `lib/schemas/` (Zod). Buat tipe TypeScript dari skema staging (`supabase gen types`).
6. Skrip data uji `scripts/seed-dev.ts` (service role, jalan lokal oleh aku): 1 admin, 1 display, 1 penjaga, 5 tim (kata sandi akun tim = `qr_token`), 25 aset dari `assets.example.json`, beberapa pos, dan berita dari `news.example.json`. Pasang ulang bila perlu; skrip harus idempoten.
7. Komponen bersama: `AppShell` (sidebar putih + isi), `PageHeader`, `Button`, `Chip`, `Card`, `Tooltip`, `Toast`, kerangka status (memuat, kosong, galat, offline). Kerjakan seperlunya; jangan membangun pustaka komponen sebelum halaman membutuhkannya.
8. Verifikasi: `pnpm/npm run build`, `lint`, `tsc --noEmit`, dan satu uji `vitest` untuk `money.ts`. Berhenti dan laporkan sebelum tahap A.
## Aturan kerja per halaman (berlaku A, B, C)
 
Untuk **setiap** halaman, ikuti urutan ini dan tampilkan hasil tiap langkah dalam laporan akhir halaman:
 
1. **Baca spesifikasi**: bagian halaman itu di `07-ui-ux.md`, komponen terkait di `DESIGN.md`, dan kontrak RPC yang dipakai di `04`. Ambil frame Figma lewat MCP Figma (lihat bagian **Desain Figma**; nama frame tiap halaman ada di Tahap A–C). Pakai `get_design_context` dan `get_screenshot`.
2. **Riset referensi** dengan skill `refero-design` (Refero MCP): cari 2–3 layar nyata yang paling mirip fungsinya (mis. order book bursa, dasbor admin, papan peringkat layar besar). Tulis ringkasan satu paragraf: apa yang diambil dan kenapa.
3. **Rancang** dengan skill `design-taste-frontend` dan `ui-ux-pro-max`: tulis brief pendek (hierarki, kepadatan, interaksi, status kosong/galat/memuat).
4. **Bangun** halaman nyata yang tersambung ke staging (bukan data palsu di klien).
5. **Periksa** dengan skill `anti-slop` (tolak tanda khas desain buatan AI: gradasi ungu, kaca buram berlebihan, kartu seragam tanpa hierarki, emoji sebagai ikon, bayangan berlapis, teks generik) lalu periksa aksesibilitas (fokus, kontras, target sentuh, `prefers-reduced-motion`).
6. **Jalankan dan lihat**: buka di peramban, tangkap layar pada lebar 1440 (dan lebar layar kerja yang relevan), uji alur dengan akun uji. **Jangan menyatakan selesai tanpa melihat hasil di peramban.** Jalankan `build`, `lint`, `tsc`.
7. **Catat deviasi** dari Figma/dokumen di `docs/13-log-implementasi.md` (apa, kenapa, apakah Figma/dokumen perlu diubah).
8. **Berhenti.** Laporan akhir halaman: apa yang jadi, tangkapan layar, deviasi, hal yang belum teruji. Tunggu "lanjut".
## Batas improvisasi
 
Kamu **boleh dan didorong** memperbaiki desain: komposisi, kepadatan, hierarki, ritme jarak, mikro-interaksi (hover, tekan, angka berubah halus), status kosong/galat/memuat, perilaku responsif, bentuk sparkline dan grafik, ikon, gerak yang tenang. Desain Figma adalah titik awal, bukan hukum.
 
Yang **tidak boleh diubah** tanpa persetujuanku:
 
- Aturan permainan, rumus, angka, dan kontrak RPC (doc 03/04/05/12). Aplikasi tidak menulis langsung ke tabel permainan.
- Keputusan produk: mode terang, tanpa permukaan hitam, biru royal untuk aksi utama, oranye sebagai aksen kecil, skala radius, kontras minimum di DESIGN.md.
- **Dua harga yang berbeda**: halaman Pasar menampilkan **harga transaksi terakhir** (`last_price`); net worth, nilai aset, Beranda, Portofolio, dan leaderboard memakai **harga peringkat** (`rank_price`, VWAP 10 menit). Label dan tooltip di Beranda harus jelas membedakannya (spesifikasi di DESIGN.md).
- Tim tidak membawa ponsel: mereka berdagang di **laptop trading** panitia, masuk lewat pindai QR di `/kiosk`, sesi keluar otomatis 5 menit. QR memuat kredensial: **jangan tampilkan, catat di log, atau simpan di URL**.
- Tombol jual tidak ada di halaman Pasar versi lama; ikuti `07-ui-ux.md` yang terbaru (form order di Pasar mendukung Beli/Jual, Limit/Market).
- Layar publik harus terbaca dari jauh dan tidak interaktif.
## Realtime (menggantikan §5 di doc 07 dan tabel stack di doc 02)
 
- Order book dan harga: **polling 5 detik** dahulu (`get_order_book`, `get_market_summary`). Jangan memakai `postgres_changes` pada `orders`/`trades` (bocor lintas tim dan boros). Bila perlu lebih cepat, usulkan migrasi pemicu database yang memanggil `realtime.send` (Broadcast per aset, pesan kecil "buku berubah", klien lalu mengambil ulang). Usulkan dulu di `docs/12-order-book.md`, tunggu persetujuanku, lalu uji di staging.
- `news_feed`, `payouts`, `game_settings` boleh memakai `postgres_changes` bila terbukti aman terhadap RLS.
- Saat tab aktif lagi atau koneksi tersambung ulang, ambil ulang semua data penting. Realtime hanyalah pemberitahuan.
- Tanpa socket.io.
## Keamanan dan kualitas
 
- Semua aksi tulis lewat server action → klien Supabase server dengan sesi pengguna → RPC. Validasi Zod di server. Peran dicek di middleware **dan** di database (jangan hanya menyembunyikan tombol).
- Idempotensi: `request_id` (uuid) dibuat per aksi di klien dan dipakai ulang saat percobaan ulang.
- Uang adalah bilangan bulat (bigint di DB; di JS pakai `bigint` atau `number` aman untuk Rupiah di bawah 2^53, putuskan dan catat di `lib/money.ts`).
- Jangan menambah paket di luar daftar tanpa menulis alasannya di log.
- Jangan mengubah `docs/` selain menambah `13-log-implementasi.md` dan usulan yang diminta di atas. Bila dokumen ternyata salah, catat di log dan tanyakan.
## Tahap A: Tim (urut, satu per satu)
 
Layout: sidebar putih 260 px + isi, laptop 1440. Frame Figma dalam kurung.
 
1. **Masuk laptop `/kiosk`** (`Kiosk — Scan QR`): kamera, QR terbaca → login → `/team`. Selalu mulai dari keadaan keluar. Banner "Sesi hampir habis" (`Tim — Sesi hampir habis`).
2. **Beranda `/team`** (`Tim — Beranda`, `Tim — Beranda (tooltip harga peringkat)`): hero tiga angka (Total, Saldo, Nilai aset) + tombol sembunyikan angka + Berita.
3. **Pasar `/team/market`** (`Tim — Pasar (order book)` dan state: dijeda, error isian, Jual · Market): daftar aset, detail + order book 5 level, form order, order terbuka. Ini halaman paling penting dan paling berisiko; luangkan waktu paling banyak.
4. **Order `Tim — Order terbuka`**, 5. **Portofolio** (`Tim — Portofolio`), 6. **Riwayat** (`Tim — Riwayat`), 7. **Daftar Pos** (`Tim — Daftar Pos`).
## Tahap B: Display
 
1. **Layar publik: 5 tim teratas** (`Layar publik — 5 tim teratas`): `get_leaderboard()` tiap ~5 detik, mengikuti `leaderboard_visible` dan pembekuan.
2. **Display pasar** (`Layar publik — Display pasar`): IKC, indeks sektor, terbaik/terlemah, berita, transaksi terakhir. Bergilir dengan layar 1. Tanpa saldo tim.
## Tahap C: Admin
 
Status game (`Admin — Status game`), Berita (`Admin — Berita`), Hadiah (`Admin — Hadiah`), Aset (`Admin — Aset`), Tim (`Admin — Tim`) + dialog Koreksi saldo (`Admin — Koreksi saldo`), Pos (`Admin — Pos`), Audit (`Admin — Audit`), Ekspor (`Admin — Ekspor`). Status game dikerjakan lebih dulu karena mengendalikan pembukaan pasar yang dibutuhkan halaman lain.
 
## Mulai
 
Kerjakan **Tahap 0** sekarang. Sebelum menulis kode, tampilkan rencana singkat (daftar berkas yang akan dibuat dan perintah yang akan dijalankan) dan tunggu aku menjawab "lanjut". Setelah Tahap 0 selesai dan kulihat, baru mulai halaman pertama Tahap A.
 