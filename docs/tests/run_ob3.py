"""Tes tambahan hasil uji mutasi: kasus yang tidak terjangkau skrip lain."""
from obh import *
# ===== sapuan market dibatasi 5 level, walau ada level lebih jauh =====
e=setup_ob("t_ob30",500_000_000); setstate(e,'open')
po(e,0,e.a1,'buy','market',None,8)
lv=[715000,717500,720000,722500,725000,727500]
ids=[oid(po(e,0,e.a1,'sell','limit',p,1)) for p in lv]
chk("6 level offer tim di atas 5 level bandar tersedia",all(q(e,"select status from orders where id=%s",(i,))[0][0]=='open' for i in ids))
r=po(e,1,e.a1,'buy','market',None,100)
chk("market beli 100 lot: berhenti setelah 5 level (42 lot bandar tersisa; A sudah membeli 8), level ke-6 dst tidak tersentuh",filled(r)==42 and ost(r)=='cancelled' and last(e,e.a1)==712500,str(r))
chk("offer tim di level lebih jauh tetap antre",all(q(e,"select status from orders where id=%s",(i,))[0][0]=='open' for i in ids))
inv(e,"sapuan")
# level yang digabung: offer tim di harga yang sama dengan level bandar dihitung satu level
e=setup_ob("t_ob31",500_000_000); setstate(e,'open')
po(e,0,e.a1,'buy','market',None,3)
po(e,0,e.a1,'sell','limit',705000,3)       # sama dengan level bandar ke-2
r=po(e,1,e.a1,'buy','market',None,100)
chk("offer tim di level yang sama dengan bandar ikut tersapu (47 lot bandar tersisa + 3 lot tim = 50)",filled(r)==50,str(r))
inv(e,"level gabung")
# ===== persediaan bandar dipotong di luar jalur normal: tidak boleh ada stok negatif =====
e=setup_ob("t_ob32",500_000_000); setstate(e,'open')
q(e,"update assets set stock=3 where id=%s",(e.a1,))      # simulasi koreksi stok manual (jalur spesifikasi admin_set_stock)
r=po(e,0,e.a1,'buy','market',None,5)
chk("stok bandar 3 padahal offer terpasang 10 lot: terisi 3, tidak ada stok negatif",r[0] and filled(r)==3 and stock(e,e.a1)==0,str(r))
chk("offer bandar yang tak punya persediaan dibatalkan",q(e,"select count(*) from orders where asset_id=%s and is_house and side='sell' and status in ('open','partial')",(e.a1,))[0][0]==0)
pickle.dump(RES,open("res_ob3.pkl","wb"))
print("grup OB3 selesai",len(RES),"cek,",sum(1 for r in RES if not r[1]),"gagal")
