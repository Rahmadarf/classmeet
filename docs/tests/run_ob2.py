from obh import *
import psycopg2
# ===== J. acak berurutan =====
e=setup_ob("t_ob20",400_000_000); setstate(e,'open')
rng=random.Random(20261117); errs={}
asset_set=[e.a1,e.a3,e.a4]
for n in range(700):
    r=rnd_op(e,rng,asset_set)
    if r[0] is False: errs[errmsg(r)]=errs.get(errmsg(r),0)+1
    if n%100==99: inv(e,f"acak {n+1}")
chk("acak: hanya error domain yang wajar",set(errs)<=ALLOWED,str(errs))
ntr=q(e,"select count(*) from trades")[0][0]
chk("acak: terjadi banyak transaksi antar-tim dan dengan bandar",ntr>150 and q(e,"select count(*) from trades where buyer_id is not null and seller_id is not null")[0][0]>10,str(ntr))
ledger(e,"acak")
print("acak:",ntr,"trades,",errs)

# ===== K. konkuren =====
def run_conc(name,nthreads_per_team,ops,seed,extra=None):
    e=setup_ob(name,400_000_000); setstate(e,'open')
    # beri modal kepemilikan agar order jual punya bahan
    asset_set=[e.a1,e.a3,e.a4]
    for i in range(3):
        for a in asset_set: po(e,i,a,'buy','market',None,4)
    errs={}; lock=threading.Lock(); unexpected=[]
    def worker(i,sd):
        rg=random.Random(sd)
        for _ in range(ops):
            try:
                r=rnd_op(e,rg,asset_set)
                if r[0] is False:
                    with lock: errs[errmsg(r)]=errs.get(errmsg(r),0)+1
            except Exception as ex:
                with lock: unexpected.append(repr(ex))
    ths=[threading.Thread(target=worker,args=(i,seed*100+i*10+k)) for i in range(3) for k in range(nthreads_per_team)]
    if extra: ths.append(threading.Thread(target=extra,args=(e,)))
    t0=time.time()
    [t.start() for t in ths]; [t.join(180) for t in ths]
    alive=[t for t in ths if t.is_alive()]
    return e,errs,unexpected,alive,time.time()-t0
e,errs,unexp,alive,dt=run_conc("t_ob21",4,60,1)
chk("konkuren 12 thread x 60 order: tidak ada thread macet (tanpa deadlock)",not alive,str(len(alive)))
chk("konkuren: tidak ada error di luar error domain",not unexp and set(errs)<=ALLOWED,str((unexp[:3],errs)))
inv(e,"konkuren"); ledger(e,"konkuren")
print("konkuren:",q(e,"select count(*) from trades")[0][0],"trades,",round(dt,1),"dtk",errs)
def churn(e):
    for _ in range(6):
        q(e,"update game_settings set house_refreshed_at=now()-interval '1 hour'")
        c=admin_conn(e.db); cur=c.cursor(); cur.execute("select process_market_cycle()"); c.close()
        time.sleep(0.3)
e,errs,unexp,alive,dt=run_conc("t_ob22",3,50,2,extra=churn)
chk("konkuren + isi ulang kuotasi bandar berulang: tidak macet",not alive,str(len(alive)))
chk("konkuren + isi ulang: tak ada error di luar domain",not unexp and set(errs)<=ALLOWED,str((unexp[:3],errs)))
inv(e,"konkuren+bandar"); ledger(e,"konkuren+bandar")
def churn2(e):
    time.sleep(1.0)
    c=admin_conn(e.db); cur=c.cursor(); cur.execute("select process_news_cycle()"); c.close()
    time.sleep(0.5)
    r=call(e,e.admin,"select admin_set_game_state('paused')"); time.sleep(0.5)
    r=call(e,e.admin,"select admin_set_game_state('open')"); time.sleep(0.5)
    call(e,e.admin,"select admin_set_game_state('finished')")
e,errs,unexp,alive,dt=run_conc("t_ob23",3,50,3,extra=churn2)
chk("konkuren + jeda/lanjut/selesai di tengah perdagangan: tidak macet",not alive,str(len(alive)))
chk("konkuren + penutupan: tak ada error di luar domain",not unexp and set(errs)<=ALLOWED,str((unexp[:3],errs)))
st=q(e,"select state from game_settings")[0][0]
chk("game benar-benar selesai",st=='finished',st)
chk("selesai: tak ada order antre dan tak ada kunci tersisa",q(e,"select count(*) from orders where status in ('open','partial')")[0][0]==0 and q(e,"select count(*) from teams where locked_cash<>0")[0][0]==0 and q(e,"select count(*) from holdings where locked_qty<>0")[0][0]==0)
inv(e,"penutupan"); ledger(e,"penutupan")
snap=q(e,"select team_id,net_worth from leaderboard_snapshot order by team_id"); live=q(e,"select team_id,net_worth from v_team_net_worth order by team_id")
chk("snapshot akhir = net worth saat ini (tak ada yang nyelip)",snap==live,str((snap,live)))

# ===== L. RLS dan hak akses =====
e=setup_ob("t_ob24",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','limit',150000,2); po(e,1,e.a3,'buy','limit',150000,1); po(e,2,e.a3,'buy','market',None,1)
mine=call(e,e.teams[0],"select team_id from orders")
chk("tim hanya membaca order miliknya (tidak order tim lain, tidak order bandar)",mine[0] and len(mine[1])==1 and all(r[0]==e.teams[0] for r in mine[1]),str(mine))
tr=call(e,e.teams[2],"select buyer_id from trades"); chk("tim hanya membaca trades yang melibatkannya",tr[0] and all(r[0]==e.teams[2] for r in tr[1]) and len(tr[1])==1,str(tr))
ad=call(e,e.admin,"select count(*) from orders"); chk("admin membaca semua order",ad[0] and ad[1][0][0]>=13)
for tbl,sql in (("orders","insert into orders(team_id,asset_id,side,kind,price,qty,remaining) values (%s,%s,'buy','limit',1000,1,1)"),
                ("orders","update orders set remaining=0"),("orders","delete from orders"),
                ("trades","delete from trades"),("trades","update trades set price=1")):
    params=(e.teams[0],e.a3) if sql.startswith("insert") else ()
    r=call(e,e.teams[0],sql,params); chk(f"tim tidak bisa menulis langsung ke {tbl}: {sql[:22]}",r[0] is False and 'permission denied' in r[1][1],str(r))
r=call(e,e.admin,"update orders set remaining=0"); chk("admin juga tidak bisa menulis langsung ke orders",r[0] is False and 'permission denied' in r[1][1],str(r))
for fn in ("process_house_quotes()","process_market_cycle()","ob_match(1)","ob_cancel(1)","ob_cancel_all()","ob_lock()"):
    for w,nm in ((e.teams[0],"tim"),(e.admin,"admin"),(e.g1,"penjaga")):
        r=call(e,w,f"select {fn}"); chk(f"{nm} tidak bisa memanggil {fn}",r[0] is False and 'permission denied' in r[1][1],str(r))
r=call(e,None,"select * from get_order_book(%s)",(e.a3,),role="anon"); chk("anon tidak bisa memanggil get_order_book",r[0] is False)
# penguncian setelah game dibuka (tanpa penanda sistem)
ns=admin_conn(e.db,sys=False); cur=ns.cursor()
for nm,sql in (("update orders","update orders set remaining=remaining where id=(select min(id) from orders)"),
               ("delete orders","delete from orders where false"),
               ("insert trades","insert into trades(asset_id,price,qty,buy_order_id,sell_order_id,buyer_id,taker_side) select asset_id,price,1,id,id,team_id,'buy' from orders limit 1"),
               ("update assets.last_price","update assets set last_price=1000"),
               ("update assets.rank_price","update assets set rank_price=1000"),
               ("update game_settings.rank_window_minutes","update game_settings set rank_window_minutes=1"),
               ("update game_settings.rank_min_lots","update game_settings set rank_min_lots=1"),
               ("update assets.init_stock","update assets set init_stock=1"),
               ("update game_settings.house_cash","update game_settings set house_cash=0"),
               ("update game_settings.fee_bps","update game_settings set fee_bps=0"),
               ("update game_settings.band_bps","update game_settings set band_bps=5000"),
               ("update game_settings.house_levels","update game_settings set house_levels=1"),
               ("update game_settings.sweep_levels","update game_settings set sweep_levels=10"),
               ("update game_settings.house_refresh_seconds","update game_settings set house_refresh_seconds=10")):
    try: cur.execute(sql); ok=True; msg=""
    except psycopg2.Error as ex: ok=False; msg=ex.pgerror.split("\n")[0]
    chk(f"setelah game dibuka tanpa penanda sistem: {nm} ditolak game_started_locked",(not ok) and 'game_started_locked' in msg,msg)
ns.close()
# ================= M. tepi =================
e=setup_ob("t_ob25",50_000_000); setstate(e,'open')
r=po(e,0,e.a3,'buy','limit',172500,1); chk("tepat di ARA a3 (172.500) diterima",r[0])
chk("1 fraksi di atas ARA (173.000) ditolak",errmsg(po(e,0,e.a3,'buy','limit',173000,1))=="price_out_of_range")
chk("tepat di ARB a3 (127.500) diterima",po(e,0,e.a3,'buy','limit',127500,1)[0])
chk("1 fraksi di bawah ARB (127.000) ditolak",errmsg(po(e,0,e.a3,'buy','limit',127000,1))=="price_out_of_range")
r=po(e,1,e.a3,'buy','limit',150000,1)
chk("kunci per lot = harga + biaya dibulatkan ke atas",q(e,"select lock_per_lot from orders where id=%s",(oid(r),))[0][0]==150000+fee(150000,1) and fee(150000,1)==375)
# aset tanpa kuotasi bandar (BBB: harga 1.000, band sempit)
nq=q(e,"select count(*) from orders where asset_id=%s and is_house",(e.a2,))[0][0]
chk("aset berharga kecil dengan band sempit: bandar tidak memasang apa pun (tanpa error)",nq==0,str(nq))
chk("order di aset itu tetap sah (limit di 1.000 antre)",po(e,0,e.a2,'buy','limit',1000,1)[0])
# batas saldo pas
c=bal(e,2)[0]
e2=setup_ob("t_ob26",704257); setstate(e2,'open')
r=po(e2,0,e2.a1,'buy','market',None,1); chk("saldo pas harga+biaya (704.257): 1 lot terbeli, saldo 0",filled(r)==1 and bal(e2,0)==(0,0),str(bal(e2,0)))
e3=setup_ob("t_ob27",704256); setstate(e3,'open')
r=po(e3,0,e3.a1,'buy','market',None,1); chk("kurang Rp 1: 0 terisi, order dibatalkan, saldo utuh",filled(r)==0 and ost(r)=='cancelled' and bal(e3,0)==(704256,0),str(r))
# bandar kehabisan persediaan
e=setup_ob("t_ob28",900_000_000); setstate(e,'open')
c_=admin_conn(e.db)
po(e,0,e.a1,'buy','market',None,50)
chk("level yang habis tidak diisi ulang sampai siklus berikutnya: borongan kedua tak mendapat apa-apa",filled(po(e,0,e.a1,'buy','market',None,50))==0 and stock(e,e.a1)==50)
q(e,"update game_settings set house_refreshed_at=now()-interval '1 hour'"); c_.cursor().execute("select process_market_cycle()")
po(e,0,e.a1,'buy','market',None,50)
chk("seluruh persediaan a1 diborong tim lewat dua siklus (stok bandar 0)",stock(e,e.a1)==0,str(stock(e,e.a1)))
q(e,"update game_settings set house_refreshed_at=now()-interval '1 hour'"); c_.cursor().execute("select process_market_cycle()"); c_.close()
chk("stok bandar 0: tidak ada offer bandar, bid bandar tetap ada",q(e,"select count(*) from orders where asset_id=%s and is_house and side='sell' and status in ('open','partial')",(e.a1,))[0][0]==0 and q(e,"select count(*) from orders where asset_id=%s and is_house and side='buy' and status='open'",(e.a1,))[0][0]==5)
inv(e,"stok habis")
# isi ulang berkala
e=setup_ob("t_ob29",100_000_000); setstate(e,'open')
before=q(e,"select max(id) from orders where is_house")[0][0]
c_=admin_conn(e.db); cur=c_.cursor(); cur.execute("select process_market_cycle()"); r1=cur.fetchone()[0]
chk("belum waktunya isi ulang: tidak ada yang berubah",r1=='idle' and q(e,"select max(id) from orders where is_house")[0][0]==before)
q(e,"update game_settings set house_refreshed_at=now()-interval '301 seconds'"); cur.execute("select process_market_cycle()"); r2=cur.fetchone()[0]
chk("lewat 300 detik: kuotasi diisi ulang (10 order x 8 aset... hanya aset yang punya band)",r2=='refreshed' and q(e,"select max(id) from orders where is_house")[0][0]>before)
po(e,0,e.a1,'buy','market',None,3)    # makan 3 lot dari offer pertama (10 lot)
chk("level yang termakan sebagian",q(e,"select remaining from orders where asset_id=%s and is_house and price=702500 and status='partial'",(e.a1,))[0][0]==7)
q(e,"update game_settings set house_refreshed_at=now()-interval '301 seconds'"); cur.execute("select process_market_cycle()")
chk("isi ulang memulihkan level ke 10 lot, kuotasi lama dibatalkan",q(e,"select remaining from orders where asset_id=%s and is_house and price=702500 and status='open'",(e.a1,))[0][0]==10 and q(e,"select count(*) from orders where asset_id=%s and is_house and status in ('open','partial')",(e.a1,))[0][0]==10)
setstate(e,'paused'); q(e,"update game_settings set house_refreshed_at=now()-interval '1 hour'"); cur.execute("select process_market_cycle()")
chk("pasar jeda: siklus pasar tidak mengisi ulang",cur.fetchone()[0]=='idle')
c_.close()
inv(e,"isi ulang")
pickle.dump(RES,open("res_ob2.pkl","wb"))
print("grup OB2 selesai",len(RES),"cek,",sum(1 for r in RES if not r[1]),"gagal")
