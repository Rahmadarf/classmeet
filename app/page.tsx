// `/` tidak pernah dirender untuk pengguna: proxy.ts mengalihkan ke beranda peran
// (sudah masuk) atau /login (belum masuk). Berkas ini hanya menjaga rute tetap ada.
export default function Home() {
  return null;
}
