/**
 * Kamus sifat aset: ciri tiap perusahaan yang dipakai sebagai PETUNJUK di berita harga. Berita tidak menyebut nama
 * perusahaan; pemain menebak aset mana yang terdampak dari ciri ini (profil di docs/05 §5.1, daftar lengkap di docs/16).
 *
 * `phrases`: anak kalimat setelah "perusahaan yang ..." (diawali kata kerja), satu dipilih per aset per berita.
 * `keys`: kata kunci khas aset ini. Kalimat pengecoh dan aset lain TIDAK boleh memuat kata kunci ini (diperiksa tes).
 * Kata kunci sengaja dibedakan antar aset yang mirip (mis. Garuda memakai penumpang/avtur, Airbus memakai pesanan pesawat).
 */
export type AssetTraits = { phrases: string[]; keys: string[] };

export const ASSET_TRAITS: Record<string, AssetTraits> = {
  // Teknologi
  AP: {
    phrases: [
      "menjual perangkat premium dengan ekosistem aplikasi sendiri",
      "rutin meluncurkan produk baru yang dinanti pelanggan setia",
      "mengandalkan toko aplikasi serta layanan musik dan video bawaan",
      "membidik pelanggan berdaya beli tinggi",
    ],
    keys: ["perangkat premium", "ekosistem aplikasi", "meluncurkan produk", "toko aplikasi"],
  },
  MI: {
    phrases: [
      "menyediakan layanan komputasi awan untuk perusahaan",
      "menjual perangkat lunak perkantoran dengan sistem berlangganan",
      "mengembangkan kecerdasan buatan untuk kebutuhan bisnis",
      "memegang kontrak teknologi jangka panjang dengan korporasi besar",
    ],
    keys: ["komputasi awan", "perangkat lunak", "kecerdasan buatan", "berlangganan"],
  },
  SA: {
    phrases: [
      "memproduksi chip memori di pabrik berskala besar",
      "menjual elektronik seperti televisi dan lemari es",
      "memasok komponen layar untuk banyak merek perangkat",
    ],
    keys: ["chip memori", "pabrik berskala besar", "televisi", "komponen layar"],
  },
  XI: {
    phrases: [
      "menjual ponsel terjangkau dalam volume besar",
      "menyasar pembeli di negara berkembang",
      "bersaing lewat harga murah dengan margin tipis",
      "melengkapi ponselnya dengan perangkat rumah pintar yang murah",
    ],
    keys: ["ponsel terjangkau", "negara berkembang", "harga murah", "rumah pintar"],
  },
  TE: {
    phrases: [
      "mengoperasikan jaringan internet dan menara seluler",
      "melayani jutaan pelanggan seluler dengan paket data",
      "menggelar kabel serat optik sampai ke rumah",
      "menyewakan pusat data dan layanan jaringan untuk perusahaan",
    ],
    keys: ["jaringan internet", "menara seluler", "paket data", "serat optik"],
  },
  // Pangan
  NE: {
    phrases: [
      "memproduksi makanan bayi dan susu formula",
      "menjual cokelat dan sereal sarapan bermerek global",
      "mengandalkan merek global yang sudah lama dipercaya keluarga",
    ],
    keys: ["makanan bayi", "cokelat", "sereal", "susu formula"],
  },
  KH: {
    phrases: [
      "membuat saus dan makanan kalengan bermerek",
      "bergantung pada pasokan tomat dan bahan baku impor",
      "memasok produk awet untuk restoran cepat saji",
      "mengelola rantai pasok bahan baku lintas negara",
    ],
    keys: ["saus", "makanan kalengan", "tomat", "restoran cepat saji", "rantai pasok bahan baku"],
  },
  DA: {
    phrases: [
      "memproduksi yoghurt dan produk susu segar",
      "menjual air minum kemasan",
      "memasarkan produk untuk gaya hidup sehat",
    ],
    keys: ["yoghurt", "produk susu", "air minum kemasan", "gaya hidup sehat"],
  },
  MA: {
    phrases: [
      "membuat biskuit dan permen untuk pasar massal",
      "menjual kopi sachet lewat warung dan toko kecil",
      "mengekspor camilan ke negara-negara Asia",
    ],
    keys: ["biskuit", "permen", "kopi sachet", "warung"],
  },
  IN: {
    phrases: [
      "memproduksi mi instan dalam jumlah besar",
      "mengolah tepung dan minyak goreng",
      "mengelola perkebunan sendiri sebagai sumber bahan baku",
    ],
    keys: ["mi instan", "tepung", "minyak goreng", "perkebunan"],
  },
  // Keuangan
  BC: {
    phrases: [
      "melayani nasabah menengah ke atas lewat tabungan dan kartu",
      "unggul dalam transaksi nontunai di dalam negeri",
      "memiliki simpanan murah dalam jumlah besar",
    ],
    keys: ["nasabah menengah ke atas", "kartu", "nontunai", "simpanan murah"],
  },
  VI: {
    phrases: [
      "mengelola jaringan pembayaran kartu lintas negara",
      "memungut biaya dari belanja daring dan perjalanan ke luar negeri",
      "menghubungkan bank dan pedagang di seluruh dunia",
    ],
    keys: ["pembayaran kartu", "lintas negara", "belanja daring", "perjalanan ke luar negeri"],
  },
  MD: {
    phrases: [
      "menyalurkan kredit korporasi dalam jumlah besar",
      "membiayai proyek infrastruktur dan program pemerintah",
      "dimiliki negara dan menjadi bank rujukan BUMN",
    ],
    keys: ["kredit korporasi", "infrastruktur", "dimiliki negara", "proyek pemerintah"],
  },
  BR: {
    phrases: [
      "menyalurkan kredit usaha kecil sampai ke desa",
      "memiliki unit pembiayaan mikro di pelosok",
      "membiayai pedagang pasar dan petani kecil",
    ],
    keys: ["usaha kecil", "desa", "pembiayaan mikro", "pedagang pasar"],
  },
  PA: {
    phrases: [
      "menyediakan dompet digital dan pembayaran daring",
      "memfasilitasi transfer uang antar pengguna",
      "melayani penjual daring kecil lintas negara",
    ],
    keys: ["dompet digital", "pembayaran daring", "transfer uang", "penjual daring"],
  },
  // Transportasi
  AI: {
    phrases: [
      "membuat pesawat penumpang di pabrik perakitan besar",
      "memegang buku pesanan pesawat yang panjang",
      "mengirim pesawat baru ke maskapai di berbagai negara",
    ],
    keys: ["pesawat penumpang", "pesanan pesawat", "pabrik perakitan", "mengirim pesawat"],
  },
  TO: {
    phrases: [
      "menjual mobil keluarga lewat dealer resmi",
      "memproduksi kendaraan hibrida dan listrik",
      "memiliki jaringan dealer dan layanan purnajual yang luas",
    ],
    keys: ["mobil", "hibrida", "dealer", "purnajual"],
  },
  HO: {
    phrases: [
      "memproduksi sepeda motor untuk kebutuhan harian",
      "menjual suku cadang lewat bengkel resmi",
      "mengoperasikan pabrik otomotif di banyak negara",
    ],
    keys: ["sepeda motor", "suku cadang", "bengkel resmi", "pabrik otomotif"],
  },
  GR: {
    phrases: [
      "menjalankan aplikasi ojek dan taksi daring",
      "mengantar makanan pesanan ke rumah pelanggan",
      "mengandalkan jutaan mitra pengemudi",
    ],
    keys: ["ojek", "taksi daring", "mengantar makanan", "pengemudi"],
  },
  GA: {
    phrases: [
      "menerbangkan penumpang di rute domestik dan internasional",
      "menjual tiket penerbangan dalam jumlah besar",
      "membeli bahan bakar avtur dalam jumlah besar",
    ],
    keys: ["penumpang", "tiket penerbangan", "rute penerbangan", "avtur"],
  },
  // Konsumen dan kesehatan
  LO: {
    phrases: [
      "menjual kosmetik dan produk perawatan kulit",
      "mengikuti tren kecantikan yang cepat berganti",
      "memasarkan produknya lewat gerai kecantikan dan influencer",
    ],
    keys: ["kosmetik", "perawatan kulit", "tren kecantikan", "gerai kecantikan"],
  },
  PF: {
    phrases: [
      "mengembangkan obat resep dan vaksin",
      "menanggung riset medis berbiaya besar",
      "menunggu izin edar dari regulator kesehatan",
    ],
    keys: ["obat resep", "vaksin", "riset medis", "izin edar"],
  },
  UN: {
    phrases: [
      "memproduksi sabun, sampo, dan deterjen",
      "menjual produk rumah tangga lewat pasar swalayan",
      "memasarkan perawatan pribadi untuk pemakaian harian",
    ],
    keys: ["sabun", "sampo", "deterjen", "produk rumah tangga"],
  },
  KA: {
    phrases: [
      "menjual obat bebas dan minuman kesehatan",
      "memasok apotek lewat jaringan distribusi yang luas",
      "membuat vitamin dan produk nutrisi",
    ],
    keys: ["obat bebas", "minuman kesehatan", "apotek", "vitamin"],
  },
  SM: {
    phrases: [
      "memproduksi jamu dan produk herbal",
      "menjual suplemen untuk kesehatan sehari-hari",
      "memanfaatkan rempah dan bahan alami",
    ],
    keys: ["jamu", "herbal", "suplemen", "rempah"],
  },
  // Energi
  CV: {
    phrases: [
      "mengebor minyak dan gas di ladang lepas pantai",
      "mengelola fasilitas pengolahan berskala global",
      "menjual minyak mentah ke pasar dunia",
    ],
    keys: ["lepas pantai", "berskala global", "minyak mentah"],
  },
  SL: {
    phrases: [
      "mendistribusikan bahan bakar lewat jaringan pom bensin",
      "memperdagangkan gas alam cair",
      "berinvestasi pada energi terbarukan",
    ],
    keys: ["pom bensin", "gas alam cair", "energi terbarukan"],
  },
  PE: {
    phrases: [
      "menyalurkan bahan bakar subsidi ke seluruh pelosok",
      "dimiliki negara dan memasok kebutuhan energi nasional",
      "mengelola stasiun pengisian dan pengolahan minyak di dalam negeri",
    ],
    keys: ["bahan bakar subsidi", "energi nasional", "stasiun pengisian"],
  },
  PN: {
    phrases: [
      "memasok listrik ke rumah dan pabrik",
      "mengoperasikan pembangkit dan jaringan transmisi",
      "menjual tenaga listrik dengan tarif yang diatur pemerintah",
    ],
    keys: ["listrik", "pembangkit", "jaringan transmisi"],
  },
  AD: {
    phrases: [
      "menambang batu bara dan menjualnya ke pembangkit",
      "mengekspor batu bara ke negara-negara Asia",
      "mengoperasikan tambang terbuka berskala besar",
    ],
    keys: ["batu bara", "tambang"],
  },
};
