/**
 * Tema bergaya "tren sektor" (contoh panitia, 20 Nov): kejadian dituturkan umum, tanpa nama perusahaan; aset yang terdampak
 * hanya bisa ditebak dari ciri perusahaannya (kamus sifat di asset-traits.ts). Bobot per simbol (`a`) menyasar ciri tertentu.
 * Tiap tema menghasilkan 2 arah x 2 varian seperti tema lain.
 */
import type { Theme } from "./news-themes";

export const THEMES_3: Theme[] = [
  {
    w: {},
    a: { KA: 3, SM: 3, PF: 2, UN: 1, DA: 1, LO: 1 },
    pos: {
      t: [
        "Permintaan produk kesehatan meningkat di berbagai daerah",
        "Distributor laporkan lonjakan pesanan produk kesehatan",
      ],
      b: "Sejumlah distributor melaporkan adanya peningkatan permintaan terhadap berbagai produk kesehatan dalam beberapa waktu terakhir. Kondisi tersebut membuat beberapa produsen mulai mengevaluasi persediaan bahan baku dan kapasitas produksi.",
    },
    neg: {
      t: [
        "Permintaan produk kesehatan melemah di berbagai daerah",
        "Distributor laporkan penurunan pesanan produk kesehatan",
      ],
      b: "Sejumlah distributor melaporkan menurunnya permintaan terhadap berbagai produk kesehatan dalam beberapa waktu terakhir. Kondisi tersebut membuat beberapa produsen menahan pembelian bahan baku dan menunda penambahan kapasitas produksi.",
    },
  },
  {
    w: {},
    a: { BC: 2, MD: 2, BR: 2, VI: 1, PA: 1 },
    pos: {
      t: [
        "Minat masyarakat pada perlindungan finansial meningkat",
        "Perencanaan keuangan jangka panjang makin diminati",
      ],
      b: "Semakin banyak masyarakat mulai mempertimbangkan perlindungan finansial sebagai bagian dari perencanaan jangka panjang. Perubahan tersebut terlihat dari meningkatnya ketertarikan terhadap berbagai produk yang menawarkan perlindungan atas risiko tertentu.",
    },
    neg: {
      t: [
        "Minat masyarakat pada perlindungan finansial menurun",
        "Perencanaan keuangan jangka panjang ditunda banyak orang",
      ],
      b: "Semakin banyak masyarakat menunda perlindungan finansial sebagai bagian dari perencanaan jangka panjang. Perubahan tersebut terlihat dari menurunnya ketertarikan terhadap berbagai produk yang menawarkan perlindungan atas risiko tertentu.",
    },
  },
  {
    w: {},
    a: { TE: 3, AP: 2, MI: 2, PA: 1, SA: 1 },
    pos: {
      t: ["Aktivitas layanan hiburan digital makin kuat", "Pengguna layanan hiburan digital terus bertambah"],
      b: "Aktivitas masyarakat pada berbagai layanan hiburan digital menunjukkan perkembangan yang cukup kuat. Sejumlah perusahaan mulai menyiapkan konten dan layanan baru untuk mempertahankan pengguna yang terus bertambah.",
    },
    neg: {
      t: ["Aktivitas layanan hiburan digital mulai jenuh", "Pengguna layanan hiburan digital berkurang"],
      b: "Aktivitas masyarakat pada berbagai layanan hiburan digital menunjukkan kejenuhan. Sejumlah perusahaan menunda konten dan layanan baru karena jumlah pengguna tidak lagi bertambah.",
    },
  },
  {
    w: {},
    a: { TO: 3, HO: 1, PN: 2, CV: -1, SL: -1, PE: -1 },
    pos: {
      t: [
        "Minat pada kendaraan ramah lingkungan melonjak",
        "Pembeli beralih ke kendaraan berbahan bakar bersih",
      ],
      b: "Semakin banyak warga mempertimbangkan kendaraan ramah lingkungan untuk keperluan harian. Sejumlah produsen kendaraan mulai menambah pilihan model dan menyiapkan layanan pendukung bagi pemilik baru.",
    },
    neg: {
      t: [
        "Minat pada kendaraan ramah lingkungan mereda",
        "Pembeli kembali ke kendaraan berbahan bakar biasa",
      ],
      b: "Minat warga pada kendaraan ramah lingkungan untuk keperluan harian mereda. Sejumlah produsen kendaraan menunda penambahan pilihan model dan menahan layanan pendukung bagi pemilik baru.",
    },
  },
  {
    w: {},
    a: { IN: 2, MA: 2, KH: 2, NE: 1, DA: 1, GR: -2 },
    pos: {
      t: [
        "Kebiasaan menyiapkan makanan di rumah menguat",
        "Belanja bahan pangan untuk dimasak sendiri meningkat",
      ],
      b: "Semakin banyak keluarga memilih menyiapkan makanan sendiri di rumah dibanding membeli jadi. Pedagang melaporkan belanja bahan pangan harian yang lebih ramai dalam beberapa pekan terakhir.",
    },
    neg: {
      t: ["Kebiasaan membeli makanan jadi menguat", "Belanja bahan pangan untuk dimasak sendiri menurun"],
      b: "Semakin banyak keluarga memilih membeli makanan jadi dibanding menyiapkannya sendiri di rumah. Pedagang melaporkan belanja bahan pangan harian yang lebih sepi dalam beberapa pekan terakhir.",
    },
  },
  {
    w: {},
    a: { PA: 3, VI: 2, BC: 2, BR: 1, TE: 1 },
    pos: {
      t: [
        "Pengguna pembayaran nontunai bertambah pesat",
        "Transaksi tanpa uang tunai makin menjadi kebiasaan",
      ],
      b: "Jumlah pengguna pembayaran nontunai bertambah pesat di berbagai kalangan. Sejumlah pedagang mulai menyediakan lebih banyak pilihan pembayaran agar tidak kehilangan pelanggan.",
    },
    neg: {
      t: ["Pengguna pembayaran nontunai berkurang", "Pelanggan kembali membayar dengan uang tunai"],
      b: "Jumlah pengguna pembayaran nontunai berkurang di berbagai kalangan. Sejumlah pedagang kembali mengutamakan uang tunai karena pelanggan enggan memakai pilihan pembayaran lain.",
    },
  },
];
