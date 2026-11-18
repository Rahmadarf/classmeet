"""Harga peringkat (VWAP jendela 10 menit, dilapis harga peringkat sebelumnya bila volume < 5 lot)."""
from obh import *
rk=lambda e,a: q(e,"select rank_price from assets where id=%s",(a,))[0][0]
e=setup_ob("t_ob40",500_000_000); setstate(e,'open')
chk("sebelum ada transaksi rank_price kosong (net worth memakai acuan)",rk(e,e.a1) is None)
po(e,0,e.a1,'buy','market',None,1)
chk("1 lot @702.500: rank = (702.500 + 4 x 700.000)/5 = 700.500; harga terakhir tetap 702.500",rk(e,e.a1)==700500 and last(e,e.a1)==702500,str(rk(e,e.a1)))
po(e,0,e.a1,'buy','market',None,4)
chk("total 5 lot @702.500: volume mencapai batas, rank = VWAP murni 702.500",rk(e,e.a1)==702500,str(rk(e,e.a1)))
po(e,0,e.a1,'buy','market',None,10)
chk("10 lot lagi (5 @702.500, 5 @705.000): VWAP 15 lot = 703.333",rk(e,e.a1)==703333 and last(e,e.a1)==705000,str(rk(e,e.a1)))
q(e,"select set_config('classmeet.system','on',false)")
q(e,"update trades set created_at=now()-interval '11 minutes'")
po(e,0,e.a1,'buy','market',None,1)
chk("semua transaksi lama keluar jendela: 1 lot @705.000 hanya menggeser 1/5 dari acuan sebelumnya -> 703.666",rk(e,e.a1)==703666,str(rk(e,e.a1)))
exp=q(e,"""select round((sum(price*qty)::numeric + 703333*greatest(5-sum(qty),0))/greatest(sum(qty),5)) from trades
           where asset_id=%s and created_at>=now()-interval '10 minutes'""",(e.a1,))[0][0]
chk("rumus dihitung ulang dari tabel trades sama dengan nilai tersimpan",exp==rk(e,e.a1),f"{exp} vs {rk(e,e.a1)}")
chk("aset lain tidak ikut berubah",rk(e,e.a3) is None)
inv(e,"rank")
pickle.dump(RES,open("res_ob4.pkl","wb"))
print("grup OB4 selesai",len(RES),"cek,",sum(1 for r in RES if not r[1]),"gagal")
