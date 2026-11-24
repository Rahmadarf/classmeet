# Uji beban k6 lewat tunnel

`scripts/load-test.mjs` memanggil RPC Supabase langsung ke `localhost:8000`. Skenario ini (`tunnel.js`) lewat alamat
**publik** (`https://api.<domain>` dan `https://app.<domain>`), jadi ikut terukur: latensi Cloudflare, gerbang Envoy,
PostgREST, dan render halaman Next.js dengan sesi tim sungguhan. Realtime (WebSocket) tidak dicakup; itu tetap lewat
`load-test.mjs`.

## Pasang k6

```bash
brew install k6
```

## Jalankan

```bash
npm run load-test:k6                                  # 30 VU tim + 2 display + 8 halaman, 3 menit
npm run load-test:k6 -- -e TEAM_VUS=60 -e DURATION=5m # lebih berat
npm run load-test:k6 -- -e PAGE_VUS=0                 # hanya API
npm run load-test:k6 -- -e TRADES=1                   # termasuk beli/jual 1 unit (MENGUBAH data staging)
```

`run-tunnel.sh` membaca `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (keduanya publik) dari `.env.local`
dan menolak alamat non-HTTPS. Akun uji dibaca dari `scripts/.seed-output.local.json` (tidak dicetak, tidak di-commit).
`APP_URL` (alamat aplikasi) diambil dari host pertama `CLASSMEET_PUBLIC_HOSTS` di `.env.local` (mis. `classmeet.<domain>`),
bukan ditebak dari alamat API. Ganti dengan `-e APP_URL=https://...` bila perlu.

> **Tanda `--` wajib** sebelum opsi k6: `npm run load-test:k6 -- -e TRADES=1`. Tanpa itu npm menelan `-e` (dibaca sebagai
> `--enjoy-by`, ada peringatan "Expanding --e to --enjoy-by") dan skenario jalan dengan pengaturan bawaan, tanpa `TRADES`.

## Yang disimulasikan

| Kelompok      | VU bawaan | Perilaku                                                                                                                      |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `api_teams`   | 30        | `get_market_snapshot` tiap 5 dtk, `get_my_summary` tiap 10 dtk, berita tiap 30 dtk (+ beli/jual tiap ±20 dtk bila `TRADES=1`) |
| `api_display` | 2         | peringkat, indeks, transaksi terakhir, dan aset tiap 5 dtk                                                                    |
| `pages_team`  | 8         | membuka `/team`, `/team/market`, `/team/portfolio`, `/team/history` dengan cookie sesi, jeda 10-30 dtk                        |

Cookie sesi dibuat persis seperti `@supabase/ssr` (`base64-` + base64url sesi, dipecah per 3180 karakter) dan sudah diverifikasi
terhadap pustaka itu. Halaman memakai `redirects: 0`: sesi yang ditolak (dialihkan ke `/kiosk`) tercatat sebagai gagal.

## Membaca hasil

- `http_req_duration{name:snapshot}`: waktu satu panggilan Pasar lewat tunnel (termasuk jarak ke Cloudflare). Ambang p95 < 1,5 detik (terukur 571-1.100 ms).
- `http_req_duration{kind:page}`: waktu render halaman tim sampai selesai. Ambang p95 < 3,5 detik (terukur 855-2.290 ms; server kemungkinan masih mode dev).
- `http_req_failed` dan `checks`: harus di bawah 1% gagal. Galat aturan game (HTTP 400 saat `TRADES=1`) tidak dihitung gagal;
  lihat `trade_accepted` untuk rasio transaksi yang diterima.
- `trade_accepted` (hanya bila `TRADES=1`): ambang `rate>0.5`. Bila hampir semua beli/jual ditolak (akun uji bersaldo atau berkepemilikan 0, mis. setelah reset game), ambang ini gagal sebagai tanda uji jalur tulis tidak bermakna. Beri akun tim 1-5 saldo dulu (Admin > Tim > Koreksi saldo).
- Ambang di `options.thresholds` berasal dari pengukuran di jaringan rumah; ukur ulang dan sesuaikan dari jaringan lokasi acara.
- Pembanding: memanggil API langsung (`-e PAGE_VUS=0 -e SUPABASE_URL=http://localhost:8000`) memberi snapshot p95 sekitar 37 ms, jadi selisihnya adalah biaya jalur tunnel.

## Peringatan

- Ini memukul endpoint **publik** Anda lewat Cloudflare dan database di balik tunnel. Jalankan di luar jam acara.
- `TRADES=1` mengubah saldo, stok, dan harga akun uji tim 1-5.
- Beban berasal dari satu laptop dan satu koneksi, jadi batas bandwidth jaringan Anda ikut memengaruhi hasil.
