from t2 import *
import pickle
# ===== GRUP N: siklus berita =====
e=setup(mkdb("t_n1")); T0,T1,T2=e.teams
A1,A2,A3,A4,A5,A6,A7,A8=e.assets
N1=[(A1,500),(A3,700),(A4,1200),(A5,-600)]
N2=[(A1,-400),(A2,300),(A6,1500),(A7,-1000)]
# --- validasi simpan
chk("save: tim ditolak",errmsg(savenews(e,N1,who=T0))=="forbidden")
chk("save: penjaga ditolak",errmsg(savenews(e,N1,who=e.g1))=="forbidden")
chk("save: 3 aset -> news_invalid_effects",errmsg(savenews(e,N1[:3]))=="news_invalid_effects")
chk("save: 8 aset -> news_invalid_effects",errmsg(savenews(e,[(a,300) for a in e.assets]))=="news_invalid_effects")
chk("save: 7 aset sukses",savenews(e,[(a,300) for a in e.assets[:7]])[0])
chk("save: aset ganda -> news_invalid_effects",errmsg(savenews(e,N1+[(A1,100)]))=="news_invalid_effects")
chk("save: persen 0 -> news_invalid_effects",errmsg(savenews(e,[(A1,0)]+N1[1:]))=="news_invalid_effects")
chk("save: +1501 -> news_invalid_effects",errmsg(savenews(e,[(A1,1501)]+N1[1:]))=="news_invalid_effects")
chk("save: -1501 -> news_invalid_effects",errmsg(savenews(e,[(A1,-1501)]+N1[1:]))=="news_invalid_effects")
chk("save: +1500 dan -1500 sukses",savenews(e,[(A1,1500),(A2,-1500)]+N1[2:])[0])
q(e,"update assets set is_active=false where id=%s",(A8,))
chk("save: aset nonaktif -> news_invalid_effects",errmsg(savenews(e,N1[:3]+[(A8,300)]))=="news_invalid_effects")
q(e,"update assets set is_active=true where id=%s",(A8,))
chk("save: judul kosong -> invalid_input",errmsg(savenews(e,N1,title="  "))=="invalid_input")
chk("save: efek bukan array -> invalid_input",errmsg(call(e,e.admin,"select admin_save_news(null,'a','b','{}'::jsonb)"))=="invalid_input")
chk("save: aset tak ada -> error (FK)",not savenews(e,N1[:3]+[(str(uuid.uuid4()),300)])[0])
n_before=q(e,"select count(*) from news")[0][0]
savenews(e,N1[:2])    # gagal
chk("save gagal: tidak ada berita/efek yatim",q(e,"select count(*) from news")[0][0]==n_before and q(e,"select count(*) from news n where not exists (select 1 from news_effects x where x.news_id=n.id)")[0][0]==0)
q(e,"delete from news")
nid1=mknews(e,N1,"Berita 1")
ok,_=savenews(e,N1[:3]+[(A6,400)],title="Berita 1 rev",nid=nid1)
chk("edit draf: efek diganti, judul berubah",ok and q(e,"select title from news where id=%s",(nid1,))[0][0]=="Berita 1 rev" and q(e,"select count(*) from news_effects where news_id=%s",(nid1,))[0][0]==4)
ok,_=savenews(e,N1,title="Berita 1",nid=nid1); chk("edit kembali",ok)
chk("edit berita tak ada -> news_not_found",errmsg(savenews(e,N1,nid=rid()))=="news_not_found")

# ===== Sistem berita baru (17 Nov): jeda acak 3-15 mnt, urutan oleh sistem, panitia terkunci =====
def ready(e,nid,flag=True,who=None): return call(e,who or e.admin,"select admin_set_news_ready(%s,%s)",(nid,flag))
def status_of(e,nid): return q(e,"select status from news where id=%s",(nid,))[0][0]
def tick(e):   # majukan jam: efek jatuh tempo dan jeda antar-berita habis
    q(e,"update news set effect_at=now()-interval '1 second' where status='live'")
    q(e,"update game_settings set news_next_allowed_at=null")
def pool(name,specs,pre=None,open_=True):
    """Siapkan game: berita dibuat dan ditandai siap SEBELUM dibuka (sesudahnya terkunci)."""
    e=setup(mkdb(name)); ids=[]
    for i,(pairs,title) in enumerate(specs):
        n=mknews(e,pairs(e) if callable(pairs) else pairs,title); ids.append(n); ready(e,n)
    if pre: pre(e)
    if open_: setstate(e,'open')
    return e,ids
G4=lambda e,k=0:[(e.assets[(k+i)%8],300) for i in range(4)]

# --- sebelum game dibuka: kumpulan dikelola admin
e=setup(mkdb("t_n1b")); T0,T1,T2=e.teams; A1,A2,A3,A4,A5,A6,A7,A8=e.assets
n1=mknews(e,G4(e,0),"R1"); n2=mknews(e,G4(e,2),"R2")
chk("setup: draf/kumpulan tersembunyi dari tim",call(e,T0,"select count(*) from news_feed")[1][0][0]==0 and call(e,T0,"select count(*) from news")[1][0][0]==0)
chk("set_ready: tim ditolak",errmsg(ready(e,n1,True,T0))=="forbidden")
chk("set_ready: penjaga ditolak",errmsg(ready(e,n1,True,e.g1))=="forbidden")
chk("set_ready: berita tak ada -> news_not_found",errmsg(ready(e,rid()))=="news_not_found")
chk("set_ready: null ditolak",errmsg(call(e,e.admin,"select admin_set_news_ready(%s,null)",(n1,)))=="invalid_input")
q(e,"update assets set is_active=false where id=%s",(A1,))
chk("set_ready: aset nonaktif -> news_invalid_effects, tetap draf",errmsg(ready(e,n1))=="news_invalid_effects" and status_of(e,n1)=="draft")
q(e,"update assets set is_active=true where id=%s",(A1,))
chk("set_ready: draf -> ready",ready(e,n1)[0] and status_of(e,n1)=="ready")
chk("set_ready dua kali -> news_wrong_status",errmsg(ready(e,n1))=="news_wrong_status")
chk("save berita ready -> news_wrong_status (keluarkan dulu)",errmsg(savenews(e,G4(e,0),nid=n1))=="news_wrong_status")
chk("un-ready: ready -> draf",ready(e,n1,False)[0] and status_of(e,n1)=="draft")
chk("un-ready berita draf -> news_wrong_status",errmsg(ready(e,n1,False))=="news_wrong_status")
ready(e,n1); ready(e,n2)
ok,r=call(e,e.admin,"select * from get_news_pool_status()")
chk("status kumpulan: 2 siap, 2 boleh terbit",ok and r[0][1]==2 and r[0][2]==2,str(r))
chk("status kumpulan: tim ditolak",errmsg(call(e,T0,"select * from get_news_pool_status()"))=="forbidden")
chk("news_would_hit_bounds tidak bisa dipanggil klien","permission denied" in (errmsg(call(e,e.admin,"select news_would_hit_bounds(%s)",(n1,))) or ""))
chk("sebelum dibuka: admin bisa membaca news (menyiapkan kumpulan)",call(e,e.admin,"select count(*) from news")[1][0][0]==2)
chk("sebelum dibuka: harga awal boleh diubah (persiapan)",q(e,"update assets set price=price where id=%s",(A1,)) is None)
chk("setup: cycle -> idle (pasar belum dibuka)",cycle(e)=="idle")

# --- dibuka: sistem memilih, jeda acak 3-15 menit, panitia terkunci
chk("buka game: satu berita ready terbit otomatis, started_at terisi",setstate(e,'open')[0] and q(e,"select count(*) from news where status='live'")[0][0]==1 and q(e,"select started_at is not null from game_settings")[0][0])
chk("terbit: berita masuk news_feed (tim melihat)",call(e,T0,"select count(*) from news_feed")[1][0][0]==1)
chk("tim TIDAK bisa membaca tabel news / effect_at",call(e,T0,"select count(*) from news")[1][0][0]==0)
chk("penjaga & display tidak bisa membaca news / news_effects",all(call(e,w,"select count(*) from "+t)[1][0][0]==0 for w in (e.g1,e.disp) for t in ("news","news_effects")))
chk("ADMIN juga tidak bisa membaca news / news_effects sesudah dibuka",call(e,e.admin,"select count(*) from news")[1][0][0]==0 and call(e,e.admin,"select count(*) from news_effects")[1][0][0]==0)
chk("news_feed tidak punya kolom waktu efek",q(e,"select count(*) from information_schema.columns where table_name='news_feed' and column_name in ('effect_at','status','pct_bps')")[0][0]==0)
chk("klien tidak bisa menulis news_feed",not call(e,e.admin,"insert into news_feed(news_id,title,body,published_at) values (gen_random_uuid(),'a','b',now())")[0] and not call(e,T0,"delete from news_feed")[0])
chk("save_news sesudah dibuka -> game_started_locked",errmsg(savenews(e,G4(e,4)))=="game_started_locked")
chk("set_ready sesudah dibuka -> game_started_locked",errmsg(ready(e,n1,False))=="game_started_locked")
chk("harga belum berubah saat berita baru terbit",[price(e,a) for a in (A1,A2,A3,A4,A5,A6)]==[10000,1000,20000,5000,8000,30000])
chk("cycle: masih menunggu",cycle(e)=="waiting")
chk("selama menunggu: beli di harga lama sukses",(call(e,e.admin,"select admin_adjust_cash(%s,1000000,'modal')",(T0,))[0] and call(e,T0,"select * from place_order(%s,%s,'buy','market',null,2)",(rid(),A1))[0]))

# --- jeda acak: 12 berita, semuanya dalam rentang, tidak semua sama
e10,ids=pool("t_n10",[(lambda e,k=k:[(e.assets[(k+i)%8],(300 if (k+i)%2==0 else -300)) for i in range(4)],"P%d"%(k+1)) for k in range(12)])
order=[]; delays=[]
for k in range(12):
    t=q(e10,"select title,extract(epoch from effect_at-published_at) from news where status='live'")
    order.append(t[0][0]); delays.append(float(t[0][1]))
    tick(e10); cycle(e10)
chk("jeda acak: semua dalam [180, 890] detik (3 mnt s.d. 14:50)",all(180<=d<=890.5 for d in delays),str(sorted(delays)))
chk("jeda acak: tidak semua sama (rentang sebaran > 60 dtk)",max(delays)-min(delays)>60,str(sorted(delays)))
chk("jeda acak: bukan kelipatan menit saja (ada detik pecahan)",any(abs(d-round(d/60)*60)>1 for d in delays),str(sorted(delays)))
chk("urutan: 12 berita terbit sekali semuanya (tanpa pengulangan)",sorted(order,key=lambda x:int(x[1:]))==["P%d"%i for i in range(1,13)],str(order))
chk("urutan: bukan urutan pembuatan (diacak sistem)",order!=["P%d"%i for i in range(1,13)],str(order))
chk("semua berita menjadi applied",q(e10,"select count(*) from news where status='applied'")[0][0]==12)
chk("kumpulan habis -> siklus idle, tidak error",cycle(e10)=="idle")
ok,r=call(e10,e10.admin,"select * from get_news_pool_status()")
chk("status kumpulan habis: ready 0, applied 12",ok and r[0][1]==0 and r[0][4]==12,str(r))
chk("selesai setelah semua berlaku",setstate(e10,'finished')[0])
d_gap=q(e10,"select news_gap_minutes from game_settings")[0][0]
chk("jeda antar-berita default 0 (harga berubah tiap 3-15 mnt)",d_gap==0)

# --- jeda min/maks dari pengaturan dipakai
e5,_=pool("t_n5",[(G4,"w1")],pre=lambda e:q(e,"update game_settings set news_delay_min_minutes=20, news_delay_max_minutes=20"))
d=float(q(e5,"select extract(epoch from effect_at-published_at) from news")[0][0])
chk("min=maks=20 menit dipakai (1200 dtk)",abs(d-1200)<1,str(d))

# --- efek diterapkan, pembulatan, price_history, gap
N1=lambda e:[(e.assets[0],500),(e.assets[2],700),(e.assets[3],1200),(e.assets[4],-600)]
e2,_=pool("t_n2",[(N1,"B1")]); A1,A2,A3,A4,A5,A6,A7,A8=e2.assets
chk("harga belum berubah sebelum jatuh tempo",price(e2,A1)==10000 and cycle(e2)=="waiting")
q(e2,"update news set effect_at=now()-interval '1 second'")
r=cycle(e2); pr={a:price(e2,a) for a in e2.assets}
chk("cycle: efek diterapkan; kumpulan habis",r=="applied",r)
chk("A1 10000 +5% = 10500",pr[A1]==10500,str(pr[A1])); chk("A3 20000 +7% = 21400",pr[A3]==21400)
chk("A4 5000 +12% = 5600",pr[A4]==5600); chk("A5 8000 -6% = 7520 -> 7500",pr[A5]==7500)
chk("aset di luar berita tidak berubah",[pr[a] for a in (A2,A6,A7,A8)]==[1000,30000,15000,2500])
nid_applied=q(e2,"select id from news")[0][0]
chk("price_history: 4 baris 'berita' berisi news_id",q(e2,"select count(*) from price_history where reason='berita' and news_id=%s",(nid_applied,))[0][0]==4)
chk("status applied + effect_applied_at",status_of(e2,nid_applied)=="applied" and q(e2,"select effect_applied_at is not null from news")[0][0])
chk("cycle ulang tidak menerapkan efek dua kali",cycle(e2)=="idle" and price(e2,A1)==10500)

# gap antar-berita dihormati bila > 0
e3,ids3=pool("t_n3",[(G4,"g1"),(lambda e:G4(e,4),"g2")],pre=lambda e:q(e,"update game_settings set news_gap_minutes=5"))
q(e3,"update news set effect_at=now()-interval '1 second' where status='live'")
chk("gap 5 mnt: diterapkan lalu berita berikutnya menunggu",cycle(e3)=="applied" and q(e3,"select count(*) from news where status='ready'")[0][0]==1)
gap=q(e3,"select extract(epoch from news_next_allowed_at-now())/60 from game_settings")[0][0]
chk("gap dihitung dari harga benar-benar berubah",4.9<gap<=5.0,str(gap))
chk("saat gap: idle",cycle(e3)=="idle")
q(e3,"update game_settings set news_next_allowed_at=now()-interval '1 second'")
chk("gap habis -> berita berikutnya terbit",cycle(e3)=="launched")
# gap 0: diterapkan + langsung terbit
e3b,_=pool("t_n3b",[(G4,"h1"),(lambda e:G4(e,4),"h2")])
q(e3b,"update news set effect_at=now()-interval '1 second' where status='live'")
chk("gap 0: applied+launched sekaligus (harga berubah tiap 3-15 mnt)",cycle(e3b)=="applied+launched")

# --- jeda game menghentikan siklus
e4,_=pool("t_n4",[(G4,"p1")])
q(e4,"update news set effect_at=now()-interval '1 minute'")
p_before={a:price(e4,a) for a in e4.assets}
setstate(e4,'paused')
chk("paused: cycle -> idle, harga tidak berubah meski efek jatuh tempo",cycle(e4)=="idle" and {a:price(e4,a) for a in e4.assets}==p_before)
q(e4,"update game_settings set paused_at=now()-interval '3 minutes'")
ok=setstate(e4,'open')[0]
r=q(e4,"select extract(epoch from effect_at-now())/60 from news where status='live'")
d=float(r[0][0]) if r and r[0][0] is not None else None
chk("resume: efek tergeser sebesar lama jeda (-1 mnt +3 mnt = +2 mnt)",bool(ok) and d is not None and 1.9<d<2.1,str(d))
chk("resume: harga belum berubah",{a:price(e4,a) for a in e4.assets}==p_before)

# --- tutup game: tidak bisa membatalkan berita, tidak ada force
e6,_=pool("t_n6",[(G4,"f1")])
chk("finish dengan berita live -> news_pending",errmsg(setstate(e6,'finished'))=="news_pending")
chk("...tidak ada opsi force (fungsi 1 argumen)",not call(e6,e6.admin,"select admin_set_game_state('finished'::game_state,true)")[0])
chk("...state tetap open, berita tetap live",q(e6,"select state from game_settings")[0][0]=="open" and q(e6,"select count(*) from news where status='live'")[0][0]==1)
tick(e6); cycle(e6)
chk("setelah harga terakhir berubah -> finish sukses",setstate(e6,'finished')[0])
q(e6,"update news set effect_at=now()-interval '1 minute'")
chk("finished: cycle idle",cycle(e6)=="idle")

# --- batas harga: calon aman didahulukan; bila semuanya berbahaya tetap jalan dengan penjepit
def bounds_pre(e):
    q(e,"update assets set price=1100 where id=%s",(e.assets[0],)); q(e,"update assets set price=99000 where id=%s",(e.assets[5],))
BADLOW=lambda e:[(e.assets[0],-1500),(e.assets[1],300),(e.assets[2],300),(e.assets[3],300)]
BADHI =lambda e:[(e.assets[5],1000),(e.assets[1],300),(e.assets[2],300),(e.assets[3],300)]
GOODB =lambda e:[(e.assets[4],300),(e.assets[6],300),(e.assets[7],300),(e.assets[1],300)]
e11,(bl,bh,gd)=pool("t_n11",[(BADLOW,"BAD_LOW"),(BADHI,"BAD_HI"),(GOODB,"GOOD")],pre=bounds_pre)
chk("batas: calon aman (GOOD) didahulukan",status_of(e11,gd)=="live" and status_of(e11,bl)=="ready" and status_of(e11,bh)=="ready")
ok,r=call(e11,e11.admin,"select * from get_news_pool_status()")
chk("status kumpulan sesudah dibuka dapat dibaca admin (hanya hitungan)",ok,str(r))
tick(e11); chk("GOOD diterapkan; berita berbahaya terpilih berikutnya (tidak macet)",cycle(e11)=="applied+launched" and q(e11,"select count(*) from news where status='live'")[0][0]==1)
tick(e11); cycle(e11); tick(e11); cycle(e11)
chk("semua berbahaya tetap diproses; harga dijepit di batas",price(e11,e11.assets[0])>=1000 and price(e11,e11.assets[5])<=100000 and q(e11,"select count(*) from assets where price<min_price or price>max_price")[0][0]==0,str([price(e11,e11.assets[0]),price(e11,e11.assets[5])]))
chk("kumpulan habis tanpa macet: semua applied",q(e11,"select count(*) from news where status='applied'")[0][0]==3)
# pembulatan ke maks
e19,_=pool("t_n19",[(lambda e:[(e.assets[1],210),(e.assets[0],300),(e.assets[2],300),(e.assets[3],300)],"ROUND")],pre=lambda e:q(e,"update assets set price=4900 where id=%s",(e.assets[1],)))
tick(e19); cycle(e19)
chk("dijepit/dibulatkan ke maks 5000",q(e19,"select price from assets where id=%s",(e19.assets[1],))[0][0]==5000)
# jepit bawah/atas
e4b,_=pool("t_n4b",[(lambda e:[(e.assets[1],1500),(e.assets[0],-1500),(e.assets[2],300),(e.assets[3],300)],"z")],pre=lambda e:q(e,"update assets set price=4900 where id=%s",(e.assets[1],)))
tick(e4b); cycle(e4b)
chk("jepit ke max_price 5000",price(e4b,e4b.assets[1])==5000); chk("turun 15%: 10000 -> 8500",price(e4b,e4b.assets[0])==8500)

# --- aset nonaktif (lewat jalur sistem) antara tayang dan efek: dilewati; saat peluncuran: kembali ke draf
e12,_=pool("t_n12",[(G4,"y1")])
q(e12,"update assets set is_active=false where id=%s",(e12.assets[3],))
p3=price(e12,e12.assets[3]); tick(e12); cycle(e12)
chk("aset nonaktif saat efek: dilewati (harga sama), 3 baris history",price(e12,e12.assets[3])==p3 and q(e12,"select count(*) from price_history")[0][0]==3)
e12b,ids=pool("t_n12b",[(G4,"y2")],open_=False)
q(e12b,"update assets set is_active=false where id=%s",(e12b.assets[3],))
setstate(e12b,'open')
chk("aset nonaktif saat peluncuran: berita kembali ke draf (tidak macet)",status_of(e12b,ids[0])=="draft" and q(e12b,"select count(*) from audit_log where action='news_launch_failed'")[0][0]==1)

# --- konkurensi: 8 pemanggil process_news_cycle bersamaan -> efek diterapkan sekali
e7,_=pool("t_n7",[(lambda e:[(e.assets[i],500) for i in range(4)],"v")])
q(e7,"update news set effect_at=now()-interval '1 second'")
par([lambda:(lambda c:(c.cursor().execute("select process_news_cycle()"),True))(admin_conn(e7.db)) for _ in range(8)])
chk("8 pemanggil bersamaan: efek diterapkan tepat sekali",q(e7,"select count(*) from price_history")[0][0]==4 and price(e7,e7.assets[0])==10500,str(price(e7,e7.assets[0])))

# --- konkurensi peluncuran: tanpa berita live, 8 pemanggil bersamaan -> hanya satu yang diluncurkan
e7b,_=pool("t_n7b",[(G4,"r%d"%i) for i in range(5)])
c0=admin_conn(e7b.db,sys=True); c0.cursor().execute("update news set status='applied', effect_applied_at=now() where status='live'"); c0.commit(); c0.close()
chk("prasyarat balapan: tidak ada berita live",q(e7b,"select count(*) from news where status='live'")[0][0]==0)
par([lambda:(lambda c:(c.cursor().execute("select process_news_cycle()"),True))(admin_conn(e7b.db)) for _ in range(8)])
chk("8 pemanggil bersamaan saat kosong: tepat satu berita live, tak ada peluncuran gagal/berita terlempar ke draf",q(e7b,"select count(*) from news where status='live'")[0][0]==1 and q(e7b,"select count(*) from audit_log where action='news_launch_failed'")[0][0]==0 and q(e7b,"select count(*) from news where status='draft'")[0][0]==0)

# --- hak akses & integritas
chk("klien tidak bisa insert langsung ke news",not call(e7,e7.admin,"insert into news(title,body,created_by) values ('a','b',%s)",(e7.admin,))[0])
chk("klien tidak bisa update status news",not call(e7,e7.admin,"update news set status='live'")[0])
chk("klien tidak bisa menulis news_effects",not call(e7,e7.admin,"delete from news_effects")[0])
chk("klien tidak bisa menulis assets/price_history",not call(e7,e7.admin,"update assets set price=1")[0] and not call(e7,e7.admin,"delete from price_history")[0])
chk("tak ada fungsi admin untuk harga/antrean/tombol siklus",q(e7,"select count(*) from pg_proc where proname in ('admin_set_price','admin_queue_news','admin_unqueue_news','admin_run_news_cycle')")[0][0]==0)
try: q(e7,"insert into news(title,body,status,created_by) values ('a','b','live',%s)",(e7.admin,)); chk("DB: live tanpa published_at ditolak",False)
except psycopg2.Error as ex: chk("DB: live tanpa published_at ditolak",ex.pgcode=="23514")

# --- Pos: tombol buka/tutup penjaga dan daftar pos ---
e8=setup(mkdb("t_n8")); setstate(e8,'open'); T8=e8.teams[0]
call(e8,e8.admin,"select admin_adjust_cash(%s,1000000,'modal')",(T8,))
chk("pos awal tutup -> post_closed",errmsg(submit(e8,e8.g1,T8,50000))=="post_closed")
ok,r=call(e8,e8.g1,"select guard_set_post_open(true)")
chk("penjaga buka pos sendiri",ok and r[0][0] is True and q(e8,"select is_open from posts where id=%s",(e8.p1,))[0][0] is True,str(r))
chk("setelah dibuka hadiah diterima",submit(e8,e8.g1,T8,50000)[0])
na=q(e8,"select count(*) from audit_log where action='guard_set_post_open'")[0][0]
call(e8,e8.g1,"select guard_set_post_open(true)")
chk("buka dua kali tidak menambah audit",q(e8,"select count(*) from audit_log where action='guard_set_post_open'")[0][0]==na)
ok,r=call(e8,e8.g1,"select guard_set_post_open(false)")
chk("penjaga tutup pos sendiri",ok and q(e8,"select is_open from posts where id=%s",(e8.p1,))[0][0] is False)
chk("pos ditutup -> hadiah baru ditolak (post_closed)",errmsg(submit(e8,e8.g1,T8,50000))=="post_closed")
chk("pos lain tidak terpengaruh",q(e8,"select is_open from posts where id=%s",(e8.p2,))[0][0] is True)
chk("hadiah lama tetap tercatat setelah pos ditutup",q(e8,"select count(*) from payouts")[0][0]==1)
chk("audit mencatat penjaga dan pos",q(e8,"select count(*) from audit_log where action='guard_set_post_open' and actor_id=%s and payload->>'post_id'=%s",(e8.g1,e8.p1))[0][0]==2)
for who,name in ((T8,"tim"),(e8.admin,"admin"),(e8.disp,"display"),(e8.orphan,"tanpa profil")):
    chk("%s tidak boleh buka/tutup pos"%name,errmsg(call(e8,who,"select guard_set_post_open(true)"))=="forbidden")
chk("argumen null ditolak",errmsg(call(e8,e8.g1,"select guard_set_post_open(null)"))=="invalid_argument")
ok,r=call(e8,e8.g2,"select guard_set_post_open(false)")
chk("penjaga 2 hanya mengubah pos 2",ok and q(e8,"select is_open from posts where id=%s",(e8.p2,))[0][0] is False and q(e8,"select is_open from posts where id=%s",(e8.p1,))[0][0] is False)
ok,r=call(e8,T8,"select * from get_post_list()")
chk("tim melihat daftar pos (2 baris, 4 kolom)",ok and len(r)==2 and len(r[0])==4,str(r))
chk("daftar pos memuat status tersedia",ok and {x[1]:x[3] for x in r}=={"Pos1":False,"Pos2":False},str(r))
chk("display melihat daftar pos",call(e8,e8.disp,"select * from get_post_list()")[0])
chk("tanpa profil tidak boleh melihat daftar pos",errmsg(call(e8,e8.orphan,"select * from get_post_list()"))=="forbidden")
chk("posts masuk publikasi Realtime",q(e8,"select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='posts'")[0][0]==1)
setstate(e8,'paused'); chk("penjaga boleh buka pos saat game dijeda",call(e8,e8.g1,"select guard_set_post_open(true)")[0])
setstate(e8,'finished',True)
chk("game selesai -> tombol pos ditolak (game_not_active)",errmsg(call(e8,e8.g1,"select guard_set_post_open(false)"))=="game_not_active")


# log perangkat trading
e13=setup(mkdb("t_n13")); T13=e13.teams[0]
chk("kiosk: tim mencatat login",call(e13,T13,"select log_kiosk_event('login','laptop-3')")[0])
chk("kiosk: logout dan idle_logout dicatat",call(e13,T13,"select log_kiosk_event('logout')")[0] and call(e13,T13,"select log_kiosk_event('idle_logout','laptop-3')")[0])
chk("kiosk: tiga baris audit atas nama tim",q(e13,"select count(*) from audit_log where actor_id=%s and action like 'kiosk_%%'",(T13,))[0][0]==3)
chk("kiosk: jenis peristiwa asing ditolak",errmsg(call(e13,T13,"select log_kiosk_event('hapus')"))=="invalid_input")
chk("kiosk: null ditolak",errmsg(call(e13,T13,"select log_kiosk_event(null)"))=="invalid_input")
chk("kiosk: nama perangkat >40 karakter ditolak",errmsg(call(e13,T13,"select log_kiosk_event('login',%s)",("x"*41,)))=="invalid_input")
for who,name in ((e13.admin,"admin"),(e13.g1,"penjaga"),(e13.disp,"display"),(e13.orphan,"tanpa profil")):
    chk("kiosk: %s tidak boleh mencatat"%name,errmsg(call(e13,who,"select log_kiosk_event('login')"))=="forbidden")


pickle.dump(RES,open("res2n.pkl","wb")); print("grupN selesai")
