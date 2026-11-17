from obh import *
import pickle, random
def fund(e,amt=1_000_000):
    for t in e.teams: call(e,e.admin,"select admin_adjust_cash(%s,%s,'modal uji')",(t,amt))
def invariants(e,tag):
    inv(e,tag); ledger(e,tag)
    chk(f"[{tag}] paling banyak satu berita live",q(e,"select count(*) from news where status='live'")[0][0]<=1)
    chk(f"[{tag}] harga acuan dalam [min,max]",q(e,"select count(*) from assets where price<min_price or price>max_price")[0][0]==0)
    chk(f"[{tag}] tak ada saldo negatif",q(e,"select count(*) from teams where cash<0")[0][0]==0)

# a) rebutan persediaan bandar
def mbuy(e,t,a,n,r=None): return call(e,t,"select * from place_order(%s,%s,'buy','market',null,%s)",(r or rid(),a,n))
def fl(r): return r[1][0][7]-r[1][0][8]
e=setup_ob("t_c1",0); setstate(e,'open'); fund(e,400_000_000)
outs=par([lambda t=t:mbuy(e,t,e.a1,40) for t in e.teams])
chk("3 tim rebut 50 lot offer bandar (masing-masing minta 40): total terisi tepat 50",all(o[0] for o in outs) and sum(fl(o) for o in outs)==50,str([fl(o) for o in outs if o[0]]))
chk("stok bandar tersisa 50 (hanya yang dipasang di offer yang terjual)",stock(e,e.a1)==50)
invariants(e,"rebutan")
e=setup_ob("t_c2",0); setstate(e,'open'); fund(e,400_000_000)
outs=par([lambda t=e.teams[i%3]:mbuy(e,t,e.a3,1) for i in range(40)])
chk("40 pembeli 1 lot, offer a3 hanya 25 lot: tepat 25 terisi, 15 dibatalkan tanpa isi",sum(fl(o) for o in outs if o[0])==25 and sum(1 for o in outs if o[0] and fl(o)==0)==15,str(sum(fl(o) for o in outs if o[0])))
chk("stok bandar a3 = 25",stock(e,e.a3)==25)
invariants(e,"offer habis")
# b2) satu tim, banyak order bersamaan: saldo/kunci tak bisa ditembus konkuren
e=setup_ob("t_c1b",0); setstate(e,"open"); fund(e,3_000_000)
outs=par([lambda:call(e,e.teams[0],"select * from place_order(%s,%s,'buy','limit',150000,1)",(rid(),e.a3)) for _ in range(30)])
okc=sum(1 for o in outs if o[0])
chk("30 order beli limit @150.000 bersamaan, saldo 3 juta: yang lolos sesuai saldo, sisanya insufficient_cash",okc==3_000_000//(150000+375) and all(errmsg(o)=="insufficient_cash" for o in outs if not o[0]),f"{okc} {[errmsg(o) for o in outs if not o[0]][:2]}")
chk("saldo bebas + terkunci = 3 juta, tidak negatif",sum(bal(e,0))==3_000_000 and bal(e,0)[0]>=0)
invariants(e,"saldo")

# c) request_id sama bersamaan
e=setup_ob("t_c3",0); setstate(e,'open'); fund(e,10_000_000); rr=rid()
outs=par([lambda:call(e,e.teams[0],"select * from place_order(%s,%s,'buy','market',null,5)",(rr,e.a1)) for _ in range(10)])
chk("10 request_id sama bersamaan: semua sukses",all(o[0] for o in outs),str(outs))
chk("...hanya 1 order, 5 lot dibeli sekali",q(e,"select count(*) from orders where request_id=%s",(rr,))[0][0]==1 and hold(e,0,e.a1)[0]==5)
rr2=rid()
c0=cash(e,1)
outs=par([lambda:submit(e,e.g2,e.teams[1],4000,rr2) for _ in range(10)])
chk("10 hadiah request_id sama bersamaan: 1 baris, saldo +4000 sekali",all(o[0] for o in outs) and q(e,"select count(*) from payouts where request_id=%s",(rr2,))[0][0]==1 and cash(e,1)==c0+4000,str(outs[:2]))

# d) stres campuran tanpa deadlock
e=setup_ob("t_c4",0); fund(e,2_000_000)
q(e,"update posts set is_open=true")
nids=[]
for k in range(8):
    pick=random.sample(e.assets,random.randint(4,7))
    nids.append(mknews(e,[(a,random.choice([-700,-300,400,700,1200,1500,-1500])) for a in pick],"n%d"%k)); call(e,e.admin,"select admin_set_news_ready(%s,true)",(nids[-1],))
setstate(e,'open')
BENIGN={"game_started_locked","insufficient_cash","insufficient_holdings","price_out_of_range","invalid_tick","order_not_open","order_not_found","already_reviewed","market_closed","payout_not_found","news_wrong_status","news_queue_full","news_not_found"}
errs=[]
def force_cycle():
    c=admin_conn(e.db); cur=c.cursor()
    cur.execute("update news set effect_at=now()-interval '1 second' where status='live'")
    cur.execute("update game_settings set news_next_allowed_at=null where random()<0.5")
    cur.execute("select process_news_cycle()"); c.close()
def worker(seed):
    rnd=random.Random(seed)
    for _ in range(40):
        op=rnd.choice("bbbbssaarpnnt"); t=rnd.choice(e.teams); a=rnd.choice(e.assets)
        if op=="b": r=rnd_op(e,rnd,[a])
        elif op=="s": r=rnd_op(e,rnd,[a])
        elif op=="a": r=submit(e,rnd.choice([e.g1,e.g2]),t,rnd.randint(1,200000))
        elif op=="r": r=submit(e,rnd.choice([e.g1,e.g2]),t,rnd.randint(1,500000))
        elif op=="p": r=call(e,rnd.choice([e.admin,e.admin2]),"select admin_set_news_ready(%s,false)",(rnd.choice(nids),))   # terkunci sejak dibuka
        elif op=="n": force_cycle(); r=(True,None)
        else: r=call(e,e.admin,"select admin_adjust_cash(%s,%s,'uji')",(t,rnd.randint(-5000,5000)))
        if not r[0]: errs.append(r[1])
par([lambda s=s:(worker(s),(True,None))[1] for s in range(8)])
bad=[x for x in errs if x[1] not in BENIGN and x[1] not in ("payout_not_found",)]
chk("stres 8 thread x 40 op: tanpa deadlock",not any(x[0]=="40P01" for x in errs),str([x for x in errs if x[0]=="40P01"][:3]))
chk("stres: tak ada error tak terduga",not bad,str(bad[:5]))
chk("stres: ada berita yang benar-benar diterapkan",q(e,"select count(*) from news where status='applied'")[0][0]>=1,str(q(e,"select status,count(*) from news group by 1")))
chk("stres: jumlah trades/pengajuan wajar (>0)",q(e,"select count(*) from trades")[0][0]>20 and q(e,"select count(*) from payouts")[0][0]>5)
invariants(e,"stres")

# e) finish vs perdagangan/ACC: snapshot harus = data akhir
ok_rounds=0
for rd in range(6):
    e=setup_ob(f"t_f{rd}",0); fund(e,3_000_000); q(e,"update posts set is_open=true")
    nn=[mknews(e,[(e.assets[(k+j)%8],500) for j in range(4)],"f%d"%k) for k in range(8)]
    for n_ in nn: call(e,e.admin,"select admin_set_news_ready(%s,true)",(n_,))
    setstate(e,'open')
    stop=threading.Event()
    def tr(seed):
        rnd=random.Random(seed)
        while not stop.is_set():
            t=rnd.choice(e.teams); a=rnd.choice([e.a1,e.a3]); k=rnd.random()
            if k<0.7: rnd_op(e,rnd,[a])
            else:
                submit(e,e.g2,t,rnd.randint(1000,90000))
    def newsloop():
        k=0
        while not stop.is_set():
            k+=1
            c=admin_conn(e.db); cur=c.cursor()
            cur.execute("update news set effect_at=now()-interval '1 second' where status='live'")
            cur.execute("update game_settings set news_next_allowed_at=null")
            try: cur.execute("select process_news_cycle()")
            except Exception: pass
            c.close()
    ths=[threading.Thread(target=tr,args=(s,)) for s in range(6)]+[threading.Thread(target=newsloop)]; [x.start() for x in ths]
    time.sleep(0.6)
    for _try in range(200):          # berita live tidak bisa dibatalkan: tunggu sampai kumpulan habis
        fin=setstate(e,'finished')
        if fin[0] or errmsg(fin)!="news_pending": break
        time.sleep(0.02)
    pr_fin={a:price(e,a) for a in e.assets}
    time.sleep(0.4); stop.set(); [x.join() for x in ths]
    snap=q(e,"select team_id,net_worth,cash from leaderboard_snapshot order by team_id")
    live=q(e,"select team_id,net_worth,cash from v_team_net_worth order by team_id")
    same=(snap==live) and pr_fin=={a:price(e,a) for a in e.assets}
    ok_rounds+=1 if (fin[0] and same) else 0
    if not same: print("beda ronde",rd,snap,live,fin)
chk("FINISH vs trade/ACC bersamaan x6 ronde: snapshot == data akhir (tak ada yang nyelip)",ok_rounds==6,f"{ok_rounds}/6")
invariants(e,"finish")
pickle.dump(RES,open("res3.pkl","wb")); print("grup3 selesai")
