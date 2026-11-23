/**
 * Tema TINGKAT SULIT (23 Nov, setelah ada fitur Analisa Pasar): kejadian dituturkan samar tanpa menyebut sektor atau
 * perusahaan yang diuntungkan; dampaknya tidak satu arah (aset di satu berita bisa naik dan turun sekaligus) dan hanya bisa
 * ditebak dari akibat tidak langsung (rantai pasok, kebiasaan konsumen, aturan) lalu dicocokkan dengan ciri perusahaan
 * (kamus sifat di asset-traits.ts). Bobot per simbol (`a`) positif = naik pada versi "pos"; versi "neg" membaliknya.
 * Tiap tema menghasilkan 2 arah x 2 varian seperti tema lain.
 */
import type { Theme } from "./news-themes";

export const THEMES_4: Theme[] = [
  {
    w: {},
    a: { VI: 2, PA: 2, GR: 2, XI: 1, AP: 1, MA: -1, BR: -1 },
    pos: {
      t: [
        "Kebiasaan berbelanja bergeser dari gerai ke layar",
        "Pembelian lewat layar ponsel kian mendominasi akhir pekan",
      ],
      b: "Pola belanja masyarakat terlihat bergeser dalam beberapa bulan terakhir. Keramaian di gerai konvensional tidak seperti sebelumnya.",
    },
    neg: {
      t: [
        "Sebagian pembeli kembali memilih datang langsung ke gerai",
        "Pembelian lewat layar ponsel kembali sepi pada akhir pekan",
      ],
      b: "Pola belanja masyarakat terlihat kembali ke cara lama dalam beberapa bulan terakhir. Keramaian di gerai konvensional mulai terasa lagi.",
    },
  },
  {
    w: {},
    a: { BC: 2, UN: 2, LO: 2, TO: 1, HO: 1, GA: 1, XI: -1 },
    pos: {
      t: [
        "Rumah tangga berpenghasilan menengah mulai longgar berbelanja",
        "Pengeluaran yang lama ditunda keluarga menengah mulai dilakukan",
      ],
      b: "Sejumlah survei rumah tangga menunjukkan kelompok berpenghasilan menengah lebih leluasa mengatur uangnya. Perubahan paling terlihat pada pos pengeluaran yang sebelumnya ditunda.",
    },
    neg: {
      t: [
        "Rumah tangga berpenghasilan menengah menahan pengeluaran",
        "Pengeluaran keluarga menengah kembali ditunda",
      ],
      b: "Sejumlah survei rumah tangga menunjukkan kelompok berpenghasilan menengah lebih berhati-hati mengatur uangnya. Perubahan paling terlihat pada pos pengeluaran yang kembali ditunda.",
    },
  },
  {
    w: {},
    a: { IN: -2, KH: -2, MA: -1, NE: -1, PN: 1, AD: 1 },
    pos: {
      t: [
        "Kemarau diperkirakan berlangsung lebih lama dari biasanya",
        "Prakiraan cuaca: musim kering bisa bertahan hingga akhir tahun",
      ],
      b: "Badan prakiraan cuaca memperingatkan musim kering tahun ini dapat bertahan lebih lama dari perkiraan semula. Beberapa daerah mulai menyiapkan langkah antisipasi.",
    },
    neg: {
      t: ["Hujan datang lebih awal dan merata", "Curah hujan merata sejak awal musim"],
      b: "Badan prakiraan cuaca menyebut musim hujan datang lebih awal dari perkiraan semula. Beberapa daerah mulai melonggarkan langkah antisipasi kekeringan.",
    },
  },
  {
    w: {},
    a: { MI: -2, AP: -1, PA: -1, VI: -1, TE: 1, BC: 1 },
    pos: {
      t: [
        "Regulator perketat tata kelola data pelanggan",
        "Aturan baru soal data pribadi mulai berlaku bulan depan",
      ],
      b: "Regulator mengumumkan ketentuan baru mengenai cara data pelanggan disimpan dan dipakai. Pelaku usaha diminta menyesuaikan sistem mereka dalam waktu singkat.",
    },
    neg: {
      t: [
        "Regulator beri kelonggaran tata kelola data pelanggan",
        "Penerapan aturan data pribadi ditunda sampai tahun depan",
      ],
      b: "Regulator mengumumkan kelonggaran ketentuan mengenai cara data pelanggan disimpan dan dipakai. Pelaku usaha mendapat waktu lebih panjang untuk menyesuaikan sistem mereka.",
    },
  },
  {
    w: {},
    a: { DA: 2, KA: 1, SM: 1, NE: -1, MA: -2, KH: -1 },
    pos: {
      t: [
        "Pilihan makanan rendah gula makin diminati kalangan muda",
        "Kesadaran soal asupan harian meningkat di kota besar",
      ],
      b: "Survei kebiasaan makan di kota besar memperlihatkan perhatian lebih besar terhadap asupan harian. Pengelola kantin dan toko kelontong mulai menata ulang rak mereka.",
    },
    neg: {
      t: [
        "Kebiasaan jajan manis kembali menguat di kota besar",
        "Minat camilan praktis meningkat lagi di kalangan muda",
      ],
      b: "Survei kebiasaan makan di kota besar memperlihatkan kembalinya kebiasaan lama. Pengelola kantin dan toko kelontong mulai menambah stok yang sebelumnya dikurangi.",
    },
  },
  {
    w: {},
    a: { BR: 3, MD: 1, MA: 1, GR: 1, BC: -1 },
    pos: {
      t: [
        "Syarat pengajuan modal untuk usaha kecil dipermudah",
        "Jalur pembiayaan baru dibuka bagi pelaku usaha rumahan",
      ],
      b: "Pemerintah menyederhanakan persyaratan bagi pelaku usaha kecil yang membutuhkan tambahan modal. Antrean pendaftaran diperkirakan memanjang dalam beberapa pekan ke depan.",
    },
    neg: {
      t: [
        "Syarat pengajuan modal untuk usaha kecil diperketat",
        "Jalur pembiayaan bagi pelaku usaha rumahan menyempit",
      ],
      b: "Pemerintah memperketat persyaratan bagi pelaku usaha kecil yang membutuhkan tambahan modal. Antrean pendaftaran diperkirakan memendek dalam beberapa pekan ke depan.",
    },
  },
  {
    w: {},
    a: { MI: 2, TE: 2, AP: 1, BC: -1, GR: -1 },
    pos: {
      t: [
        "Perusahaan mempercepat otomasi pekerjaan administratif",
        "Alat bantu kerja berbasis kecerdasan meluas di perkantoran",
      ],
      b: "Banyak perusahaan mulai menggeser pekerjaan rutin ke sistem otomatis. Divisi pendukung di sejumlah kantor sedang menata ulang tugas mereka.",
    },
    neg: {
      t: [
        "Perusahaan menunda otomasi pekerjaan administratif",
        "Penerapan alat bantu kerja berbasis kecerdasan tersendat",
      ],
      b: "Banyak perusahaan menunda rencana menggeser pekerjaan rutin ke sistem otomatis. Divisi pendukung di sejumlah kantor kembali memakai cara kerja lama.",
    },
  },
  {
    w: {},
    a: { XI: 2, MA: 1, KH: 1, UN: 1, LO: -2, AP: -1, GA: -1 },
    pos: {
      t: [
        "Pembeli kian rajin membandingkan harga sebelum memutuskan",
        "Pencarian barang berharga murah melonjak di berbagai platform",
      ],
      b: "Data kunjungan di sejumlah platform memperlihatkan pembeli menghabiskan lebih banyak waktu membandingkan pilihan. Keputusan membeli cenderung diambil lebih lambat.",
    },
    neg: {
      t: [
        "Pembeli kembali mementingkan merek ketimbang harga",
        "Minat pada produk kelas atas pulih di berbagai platform",
      ],
      b: "Data kunjungan di sejumlah platform memperlihatkan pembeli lebih cepat menentukan pilihan. Keputusan membeli cenderung diambil tanpa banyak membandingkan.",
    },
  },
  {
    w: {},
    a: { GA: 2, VI: 2, PA: 1, AI: 1, GR: -1 },
    pos: {
      t: [
        "Pemesanan perjalanan lintas negara melonjak menjelang libur",
        "Pengajuan paspor baru membludak di kantor layanan",
      ],
      b: "Kantor layanan dokumen perjalanan melaporkan antrean yang lebih panjang dari biasanya. Banyak keluarga mulai menyusun rencana libur lebih awal.",
    },
    neg: {
      t: [
        "Pemesanan perjalanan lintas negara melemah menjelang libur",
        "Pengajuan paspor baru menurun di kantor layanan",
      ],
      b: "Kantor layanan dokumen perjalanan melaporkan antrean yang lebih pendek dari biasanya. Banyak keluarga menunda rencana libur mereka.",
    },
  },
  {
    w: {},
    a: { SA: -2, AP: -2, XI: -1, TO: -2, HO: -1, AI: -1 },
    pos: {
      t: [
        "Pengiriman komponen presisi tersendat di beberapa pelabuhan",
        "Lini perakitan menunggu kiriman komponen yang terlambat",
      ],
      b: "Pengelola pelabuhan melaporkan penumpukan kiriman komponen dalam beberapa hari terakhir. Sejumlah lini perakitan disebut menyesuaikan jadwal kerja mereka.",
    },
    neg: {
      t: [
        "Pengiriman komponen presisi kembali lancar di pelabuhan",
        "Lini perakitan menerima kiriman komponen yang tertunda",
      ],
      b: "Pengelola pelabuhan melaporkan penumpukan kiriman komponen mulai terurai. Sejumlah lini perakitan disebut kembali ke jadwal kerja normal.",
    },
  },
  {
    w: {},
    a: { VI: 2, PA: 1, BC: 1, BR: 1, MD: 1, TE: 1 },
    pos: {
      t: [
        "Pembayaran tanpa uang tunai makin lazim di kota kecil",
        "Pedagang pasar mulai menerima pembayaran lewat ponsel",
      ],
      b: "Kebiasaan membayar di kota-kota kecil berubah lebih cepat dari perkiraan. Pedagang yang dulu menolak kini mulai membuka pilihan baru bagi pembeli.",
    },
    neg: {
      t: [
        "Uang tunai kembali jadi pilihan utama di kota kecil",
        "Pedagang pasar menghentikan layanan pembayaran lewat ponsel",
      ],
      b: "Kebiasaan membayar di kota-kota kecil kembali ke cara lama. Pedagang yang sempat mencoba menyerah dan menutup pilihan baru bagi pembeli.",
    },
  },
  {
    w: {},
    a: { MD: 2, PN: 1, AD: 1, UN: 1, HO: 1, TO: 1, GA: -1 },
    pos: {
      t: [
        "Pembangunan hunian dan jalan baru dipercepat di pinggiran kota",
        "Kawasan pinggiran kota ramai oleh proyek pembangunan",
      ],
      b: "Sejumlah proyek di kawasan pinggiran kota dilaporkan berjalan lebih cepat dari jadwal. Warga sekitar mulai merasakan perubahan di sekeliling mereka.",
    },
    neg: {
      t: [
        "Pembangunan hunian dan jalan baru melambat di pinggiran kota",
        "Proyek di kawasan pinggiran kota berhenti sementara",
      ],
      b: "Sejumlah proyek di kawasan pinggiran kota dilaporkan berjalan lebih lambat dari jadwal. Warga sekitar mulai menyadari pekerjaan di sekeliling mereka terhenti.",
    },
  },
  {
    w: {},
    a: { MI: 2, TE: 1, GR: -2, TO: -1, SL: -1, PE: -1, CV: -1 },
    pos: {
      t: [
        "Banyak kantor memperluas jadwal kerja dari rumah",
        "Jadwal kerja fleksibel menjadi pilihan utama perusahaan",
      ],
      b: "Sejumlah perusahaan mengumumkan perubahan pengaturan kerja bagi karyawannya. Kawasan perkantoran melaporkan suasana yang berbeda dari biasanya.",
    },
    neg: {
      t: [
        "Banyak kantor memanggil karyawan kembali bekerja di lokasi",
        "Jadwal kerja dari rumah dikurangi di berbagai perusahaan",
      ],
      b: "Sejumlah perusahaan mengumumkan perubahan pengaturan kerja bagi karyawannya. Kawasan perkantoran melaporkan keramaian yang kembali seperti dulu.",
    },
  },
  {
    w: {},
    a: { PF: 2, KA: 2, SM: 2, GA: -1, GR: -1, DA: 1 },
    pos: {
      t: [
        "Kunjungan ke fasilitas kesehatan meningkat dalam dua pekan",
        "Klinik melaporkan antrean pasien lebih panjang dari biasanya",
      ],
      b: "Sejumlah fasilitas kesehatan melaporkan peningkatan kunjungan pada pekan-pekan terakhir. Pihak pengelola belum menyebut penyebab pastinya.",
    },
    neg: {
      t: [
        "Kunjungan ke fasilitas kesehatan menurun dalam dua pekan",
        "Klinik melaporkan antrean pasien lebih pendek dari biasanya",
      ],
      b: "Sejumlah fasilitas kesehatan melaporkan penurunan kunjungan pada pekan-pekan terakhir. Pihak pengelola belum menyebut penyebab pastinya.",
    },
  },
  {
    w: {},
    a: { PE: 1, SL: 1, GA: 1, IN: -2, KH: -1, MA: -1, UN: -1 },
    pos: {
      t: ["Ongkos kirim barang antar pulau naik", "Tarif angkutan barang antar pulau disesuaikan ke atas"],
      b: "Penyedia jasa angkutan antar pulau menyampaikan penyesuaian tarif kepada pelanggan. Pemilik barang diminta menghitung ulang biaya pengiriman mereka.",
    },
    neg: {
      t: ["Ongkos kirim barang antar pulau turun", "Tarif angkutan barang antar pulau melandai"],
      b: "Penyedia jasa angkutan antar pulau menyampaikan penurunan tarif kepada pelanggan. Pemilik barang diminta menghitung ulang biaya pengiriman mereka.",
    },
  },
  {
    w: {},
    a: { HO: 3, GR: 2, PE: 1, TO: -1 },
    pos: {
      t: [
        "Pengantaran barang harian meningkat tajam di perkotaan",
        "Permintaan jasa antar di kota besar kewalahan dilayani",
      ],
      b: "Volume pengantaran barang harian di kota-kota besar naik cukup tinggi pada bulan ini. Banyak pelanggan mengeluhkan waktu tunggu yang lebih lama.",
    },
    neg: {
      t: ["Pengantaran barang harian melambat di perkotaan", "Permintaan jasa antar di kota besar mereda"],
      b: "Volume pengantaran barang harian di kota-kota besar turun cukup rendah pada bulan ini. Banyak pelanggan melaporkan waktu tunggu yang lebih singkat.",
    },
  },
  {
    w: {},
    a: { BC: 2, MD: 2, BR: 1, PA: -1, VI: -1 },
    pos: {
      t: [
        "Simpanan masyarakat bertambah di lembaga keuangan",
        "Masyarakat lebih gemar menyimpan uangnya akhir-akhir ini",
      ],
      b: "Data bulanan memperlihatkan saldo simpanan rumah tangga naik lebih cepat dari biasanya. Sebagian orang disebut mengurangi pengeluaran yang tidak mendesak.",
    },
    neg: {
      t: [
        "Simpanan masyarakat berkurang di lembaga keuangan",
        "Masyarakat lebih sering membelanjakan simpanannya akhir-akhir ini",
      ],
      b: "Data bulanan memperlihatkan saldo simpanan rumah tangga turun lebih cepat dari biasanya. Sebagian orang disebut menambah pengeluaran yang tidak mendesak.",
    },
  },
  {
    w: {},
    a: { SA: 2, XI: 2, AP: 1, TE: 1, PN: -1 },
    pos: {
      t: ["Penggantian perangkat elektronik rumah meningkat", "Toko elektronik ramai menjelang akhir tahun"],
      b: "Pengelola pusat perbelanjaan melaporkan lalu lintas pengunjung yang lebih padat di lantai peralatan rumah. Banyak pembeli datang dengan daftar barang yang sudah disiapkan.",
    },
    neg: {
      t: ["Penggantian perangkat elektronik rumah menurun", "Toko elektronik sepi menjelang akhir tahun"],
      b: "Pengelola pusat perbelanjaan melaporkan lalu lintas pengunjung yang lebih sepi di lantai peralatan rumah. Banyak pembeli hanya melihat-lihat tanpa membeli.",
    },
  },
  {
    w: {},
    a: { UN: -2, DA: -2, NE: -1, MA: -1, LO: -1, SM: 1 },
    pos: {
      t: [
        "Aturan kemasan produk konsumsi diperketat",
        "Pelaku industri diminta menyesuaikan kemasan produknya",
      ],
      b: "Pemerintah mengumumkan ketentuan baru mengenai bahan dan ukuran kemasan produk sehari-hari. Pelaku industri diberi waktu terbatas untuk menyesuaikan lini produksinya.",
    },
    neg: {
      t: [
        "Aturan kemasan produk konsumsi dilonggarkan",
        "Pelaku industri diberi waktu panjang menyesuaikan kemasannya",
      ],
      b: "Pemerintah mengumumkan kelonggaran ketentuan mengenai bahan dan ukuran kemasan produk sehari-hari. Pelaku industri mendapat waktu lebih panjang untuk menyesuaikan lini produksinya.",
    },
  },
  {
    w: {},
    a: { AI: 2, GA: 2, GR: -1, TO: -1, HO: -1 },
    pos: {
      t: ["Jadwal serah terima armada baru dimajukan", "Pengiriman pesawat baru ke maskapai dipercepat"],
      b: "Pihak pabrikan menyampaikan penyesuaian jadwal serah terima kepada para pelanggannya. Beberapa pelanggan disebut sudah menyiapkan rute baru.",
    },
    neg: {
      t: ["Jadwal serah terima armada baru diundur", "Pengiriman pesawat baru ke maskapai tertunda"],
      b: "Pihak pabrikan menyampaikan penundaan jadwal serah terima kepada para pelanggannya. Beberapa pelanggan disebut harus menyesuaikan rute yang sudah disiapkan.",
    },
  },
  {
    w: {},
    a: { PN: 2, AD: 2, DA: 1, SA: 1, PE: -1 },
    pos: {
      t: [
        "Pemakaian pendingin ruangan melonjak di tengah suhu panas",
        "Suhu panas dorong pemakaian listrik harian",
      ],
      b: "Suhu udara beberapa hari terakhir tercatat di atas rata-rata. Banyak rumah dan kantor terlihat menyalakan peralatan lebih lama dari biasanya.",
    },
    neg: {
      t: [
        "Pemakaian pendingin ruangan menurun di tengah suhu sejuk",
        "Suhu sejuk menahan pemakaian listrik harian",
      ],
      b: "Suhu udara beberapa hari terakhir tercatat di bawah rata-rata. Banyak rumah dan kantor terlihat mematikan peralatan lebih cepat dari biasanya.",
    },
  },
  {
    w: {},
    a: { LO: 3, UN: 1, SM: 1, GR: -1 },
    pos: {
      t: [
        "Tren perawatan diri menyebar cepat di kalangan pekerja muda",
        "Antrean gerai perawatan diri memanjang saat akhir pekan",
      ],
      b: "Sejumlah gerai melaporkan peningkatan kunjungan dari pekerja muda pada akhir pekan. Pengunjung disebut datang atas rekomendasi teman dan media sosial.",
    },
    neg: {
      t: [
        "Minat pada perawatan diri mendingin di kalangan pekerja muda",
        "Gerai perawatan diri lebih lengang saat akhir pekan",
      ],
      b: "Sejumlah gerai melaporkan penurunan kunjungan dari pekerja muda pada akhir pekan. Pengunjung disebut lebih memilih kegiatan lain bersama teman.",
    },
  },
  {
    w: {},
    a: { SL: 2, PE: 2, CV: 1, PN: -1, KH: -1, IN: -1 },
    pos: {
      t: [
        "Pasokan bahan bakar rumah tangga dialihkan ke wilayah baru",
        "Pembagian bahan bakar bersubsidi disesuaikan di beberapa kota",
      ],
      b: "Pihak penyalur menyampaikan penyesuaian pola pembagian bahan bakar di beberapa kota. Warga diminta memperhatikan pengumuman jadwal terbaru.",
    },
    neg: {
      t: [
        "Pasokan bahan bakar rumah tangga kembali ke pola lama",
        "Pembagian bahan bakar bersubsidi dikembalikan ke jadwal semula",
      ],
      b: "Pihak penyalur menyampaikan pengembalian pola pembagian bahan bakar di beberapa kota. Warga diminta memperhatikan pengumuman jadwal terbaru.",
    },
  },
  {
    w: {},
    a: { TE: 3, XI: 2, SA: 1, MI: 1, AP: -1 },
    pos: {
      t: [
        "Jaringan data di pelosok diperluas lebih cepat dari rencana",
        "Pelanggan baru dari daerah terpencil mulai terhubung",
      ],
      b: "Pembangunan fasilitas penghubung di beberapa daerah terpencil dilaporkan selesai lebih awal. Warga setempat mulai mencoba berbagai layanan yang sebelumnya tidak terjangkau.",
    },
    neg: {
      t: [
        "Perluasan jaringan data di pelosok mundur dari rencana",
        "Warga daerah terpencil masih menunggu sambungan baru",
      ],
      b: "Pembangunan fasilitas penghubung di beberapa daerah terpencil dilaporkan mundur dari jadwal. Warga setempat masih menunggu layanan yang dijanjikan.",
    },
  },
  {
    w: {},
    a: { KA: 2, PF: 2, UN: 1, NE: 1, LO: -1, MA: -1 },
    pos: {
      t: [
        "Pembelian kebutuhan rumah tangga dalam jumlah besar meningkat",
        "Pembeli menimbun kebutuhan harian menjelang pergantian musim",
      ],
      b: "Sejumlah pengelola toko menyebut pembeli mengambil jumlah lebih banyak dari biasanya pada setiap kunjungan. Beberapa rak dilaporkan cepat kosong menjelang akhir pekan.",
    },
    neg: {
      t: [
        "Pembelian kebutuhan rumah tangga dalam jumlah besar menurun",
        "Pembeli mengurangi stok kebutuhan harian menjelang pergantian musim",
      ],
      b: "Sejumlah pengelola toko menyebut pembeli mengambil jumlah lebih sedikit dari biasanya pada setiap kunjungan. Beberapa rak dilaporkan tetap penuh menjelang akhir pekan.",
    },
  },
];
