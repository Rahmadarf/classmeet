/**
 * "Suara" fiktif untuk memberi tekstur pada berita (23 Nov, tahap 2 perbaikan teks): kota, tokoh, lembaga, sumber, kutipan
 * netral, dan adegan lapangan. Semua REKAAN: tidak ada nama perusahaan asli (diperiksa `validatePool` terhadap nama aset) dan
 * tidak memuat kata kunci sifat aset (diperiksa tes). Kutipan dan adegan sengaja NETRAL (tanpa arah, tanpa sektor) supaya tidak
 * membocorkan atau menyesatkan efek harga; genre hanya mengubah cara peristiwa dituturkan.
 */
export const CITIES = [
  "Jakarta",
  "Surabaya",
  "Medan",
  "Makassar",
  "Bandung",
  "Semarang",
  "Palembang",
  "Balikpapan",
  "Denpasar",
  "Pontianak",
  "Yogyakarta",
  "Manado",
  "Banjarmasin",
  "Pekanbaru",
  "Malang",
] as const;

/** [nama, jabatan, lembaga] fiktif. */
export const PEOPLE: readonly (readonly [string, string, string])[] = [
  ["Hendra Wibowo", "direktur riset", "Sekuritas Nusa Artha"],
  ["Sari Lestari", "kepala ekonom", "Institut Kajian Ekonomi Nusantara"],
  ["Rudi Hartono", "ketua umum", "Asosiasi Pengusaha Muda Kepulauan"],
  ["Maya Kusumawati", "juru bicara", "Badan Pengkajian Perdagangan"],
  ["Bambang Irawan", "analis senior", "Sekuritas Cakra Mandala"],
  ["Dewi Anggraini", "peneliti utama", "Pusat Studi Pasar Modal Indonesia Timur"],
  ["Agus Pratama", "sekretaris jenderal", "Dewan Pelaku Usaha Nasional"],
  ["Lina Marlina", "kepala bidang riset", "Lembaga Kajian Konsumen Nusantara"],
  ["Yoga Permana", "ekonom", "Sekuritas Garuda Artha"],
  ["Rina Susanti", "direktur eksekutif", "Forum Ekonomi Daerah"],
  ["Doni Saputra", "kepala analis", "Sekuritas Bintang Timur"],
  ["Fitri Handayani", "wakil ketua", "Kamar Dagang Kota Pelabuhan"],
  ["Eko Nugroho", "pengamat pasar", "Lembaga Studi Keuangan Terapan"],
  ["Tuti Rahayu", "kepala divisi kajian", "Badan Pengkajian Perdagangan"],
  ["Wahyu Setiawan", "analis riset", "Sekuritas Samudra Jaya"],
  ["Nina Oktaviani", "koordinator riset", "Pusat Kajian Kebijakan Ekonomi"],
  ["Hari Kurniawan", "ketua bidang ekonomi", "Himpunan Pengusaha Kepulauan"],
  ["Ayu Prameswari", "ekonom senior", "Institut Kajian Ekonomi Nusantara"],
  ["Joko Santoso", "kepala riset", "Sekuritas Anugerah Prima"],
  ["Sinta Maharani", "juru bicara", "Dewan Pelaku Usaha Nasional"],
  ["Taufik Hidayat", "peneliti", "Lembaga Studi Keuangan Terapan"],
  ["Rahma Wulandari", "direktur kebijakan", "Forum Ekonomi Daerah"],
  ["Imam Sutrisno", "pengamat ekonomi", "Universitas Cendekia Nusantara"],
  ["Putri Ananda", "kepala komunikasi", "Kamar Dagang Kota Pelabuhan"],
];

/** Lembaga fiktif yang mengeluarkan keterangan tertulis. */
export const ORGANIZATIONS = [
  "Badan Pengkajian Perdagangan",
  "Dewan Pelaku Usaha Nasional",
  "Forum Ekonomi Daerah",
  "Pusat Kajian Kebijakan Ekonomi",
  "Kamar Dagang Kota Pelabuhan",
  "Himpunan Pengusaha Kepulauan",
  "Lembaga Kajian Konsumen Nusantara",
  "Kantor Staf Ekonomi Daerah",
] as const;

export const SOURCES = [
  "sumber di kalangan pelaku usaha",
  "dokumen yang dilihat redaksi",
  "seorang pejabat yang enggan disebut namanya",
  "dua pengamat yang dihubungi redaksi",
  "keterangan sejumlah pelaku usaha di lapangan",
  "catatan rapat yang diperoleh redaksi",
  "pihak yang mengetahui pembahasan tersebut",
] as const;

/** Kutipan netral: tanpa arah, sektor, atau besar dampak. */
export const QUOTES = [
  "Kami masih menghitung dampaknya secara menyeluruh",
  "Sebaiknya semua pihak menunggu data lengkap sebelum menarik kesimpulan",
  "Keputusan ini sudah lama dibahas di internal",
  "Kami akan menyampaikan perkembangan berikutnya pekan depan",
  "Kami terbuka terhadap masukan dari semua pihak",
  "Perubahan seperti ini biasanya baru terasa setelah beberapa waktu",
  "Yang kami pantau adalah angka-angka bulan berikutnya",
  "Kami mengimbau masyarakat tetap tenang dan mengikuti perkembangan",
  "Detailnya masih kami finalkan bersama pihak terkait",
  "Respons di lapangan sejauh ini beragam",
  "Kami belum bisa memastikan seberapa besar pengaruhnya",
  "Ini bagian dari proses yang memang sudah berjalan",
] as const;

/** Adegan lapangan netral (tanpa arah dan sektor). */
export const SCENES = [
  "Di sebuah kafe dekat kawasan perkantoran Sudirman, sejumlah pegawai terlihat membahas kabar ini sambil makan siang.",
  "Di Surabaya, antrean di loket layanan terpadu tampak seperti hari biasa.",
  "Di Makassar, sebagian warga mengaku baru mendengar kabar ini dari grup pesan.",
  "Di sebuah toko buku di Yogyakarta, rak ekonomi ramai dikunjungi mahasiswa.",
  "Di Medan, sejumlah sopir angkutan kota menyimak siaran radio sambil beristirahat di terminal.",
  "Di Semarang, beberapa pemilik toko mengaku belum mengubah rencana mereka pekan ini.",
  "Di Bandung, seorang pelaku usaha rintisan menyebut timnya baru akan membahas kabar ini dalam rapat Senin.",
  "Di Denpasar, pengunjung pusat belanja tampak seramai akhir pekan biasa.",
  "Di Palembang, warga yang ditemui di tepi sungai mengaku belum mengikuti kabar ini secara dekat.",
  "Di Balikpapan, sejumlah pegawai kantor memanfaatkan jam istirahat untuk membaca berita di ponsel.",
  "Di Pontianak, kedai kopi dekat pelabuhan ramai dengan obrolan soal cuaca dan harga-harga.",
  "Di Malang, mahasiswa ekonomi di sebuah kampus menjadikan kabar ini bahan diskusi kelas.",
  "Di Manado, beberapa pelaku usaha mikro menyebut mereka menunggu keterangan resmi lebih lanjut.",
  "Di Pekanbaru, petugas di sebuah balai pertemuan sibuk menyiapkan acara yang dijadwalkan sore ini.",
  "Di Banjarmasin, para pedagang di tepi sungai berjualan seperti biasa pagi ini.",
  "Di Jakarta, pejalan kaki di kawasan niaga terlihat lebih ramai dari hari-hari sebelumnya.",
] as const;
