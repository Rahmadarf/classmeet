from obh import *
# ================= A. dasar =================
e=setup_ob("t_ob1",0)
r=po(e,0,e.a1,'buy','market',None,1)
chk("pasar belum dibuka: order ditolak market_closed",errmsg(r)=="market_closed",str(r))
setstate(e,'open')
asks=q(e,"select price,remaining from orders where asset_id=%s and is_house and side='sell' and status='open' order by price",(e.a1,))
bids=q(e,"select price,remaining from orders where asset_id=%s and is_house and side='buy' and status='open' order by price desc",(e.a1,))
chk("bandar a1: 5 offer 702.500..712.500 @10 lot",asks==[(702500+2500*i,10) for i in range(5)],str(asks))
chk("bandar a1: 5 bid 697.500..687.500 @10 lot",bids==[(697500-2500*i,10) for i in range(5)],str(bids))
a3=q(e,"select side,price from orders where asset_id=%s and is_house and status='open' order by side,price",(e.a3,))
chk("bandar a3 (fraksi 500): offer 150.500.. dan bid 149.500..",[p for s,p in a3 if s=='sell']==[150500+500*i for i in range(5)] and [p for s,p in a3 if s=='buy']==[147500+500*i for i in range(5)],str(a3))
chk("lot per level a3 = ceil(50/10) = 5",q(e,"select distinct remaining from orders where asset_id=%s and is_house and status='open'",(e.a3,))==[(5,)])
inv(e,"awal")
# peran
for nm,who in (("admin",e.admin),("penjaga",e.g1),("display",e.disp),("tanpa profil",e.orphan)):
    chk(f"place_order ditolak untuk {nm}",errmsg(po(e,0,e.a1,'buy','market',None,1,who=who))=="forbidden")
chk("tanpa login ditolak",errmsg(call(e,None,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1)))=="forbidden")
# validasi
call(e,e.admin,"select admin_adjust_cash(%s,%s,'modal')",(e.teams[0],20_000_000))
for nm,args in (("qty 0",('buy','market',None,0)),("qty negatif",('buy','market',None,-1)),("sisi salah",('x','market',None,1)),
                ("jenis salah",('buy','stop',None,1)),("limit tanpa harga",('buy','limit',None,1)),("market dengan harga",('buy','market',700000,1)),
                ("harga nol",('buy','limit',0,1)),("qty terlalu besar",('buy','market',None,100001))):
    chk(f"validasi: {nm} -> invalid_input",errmsg(po(e,0,e.a1,*args))=="invalid_input",str(po(e,0,e.a1,*args)))
chk("harga bukan kelipatan fraksi -> invalid_tick",errmsg(po(e,0,e.a1,'buy','limit',700100,1))=="invalid_tick")
chk("harga di atas maks aset 800.000 (ARA 805.000 dijepit) -> price_out_of_range",errmsg(po(e,0,e.a1,'buy','limit',805000,1))=="price_out_of_range")
chk("harga di bawah ARB (595.000-) -> price_out_of_range",errmsg(po(e,0,e.a1,'buy','limit',592500,1))=="price_out_of_range")
chk("tepat di ARB 595.000 diterima",po(e,0,e.a1,'buy','limit',595000,1)[0] is True)
chk("limit di ARA a4 (345.000) lolos validasi harga; ditolak hanya karena tak punya lot",errmsg(po(e,0,e.a4,'sell','limit',345000,1))=="insufficient_holdings")
chk("aset tak dikenal -> asset_not_found",errmsg(po(e,0,rid(),'buy','market',None,1))=="asset_not_found")
q(e,"update assets set is_active=false where id=%s",(e.a8,))
chk("aset nonaktif -> asset_not_found",errmsg(po(e,0,e.a8,'buy','market',None,1))=="asset_not_found")
q(e,"update assets set is_active=true where id=%s",(e.a8,))
chk("tim bersaldo 0: order beli ditolak insufficient_cash",errmsg(po(e,1,e.a1,'buy','market',None,1))=="insufficient_cash" and errmsg(po(e,1,e.a1,'buy','limit',700000,1))=="insufficient_cash")
chk("jual tanpa kepemilikan -> insufficient_holdings",errmsg(po(e,1,e.a1,'sell','limit',700000,1))=="insufficient_holdings")

# ================= B. beli market dari bandar, biaya, pembukuan =================
e=setup_ob("t_ob2",20_000_000); setstate(e,'open')
c0=bal(e,0)[0]; h0=hc(e)
r=po(e,0,e.a1,'buy','market',None,1)
f=fee(702500,1)
chk("market beli 1 lot: terisi di offer terbaik 702.500",r[0] and filled(r)==1 and ost(r)=='filled',str(r))
chk("saldo berkurang harga + biaya 0,25% (dibulatkan ke atas)",bal(e,0)[0]==c0-702500-f and f==1757,f"{c0-bal(e,0)[0]}")
chk("kepemilikan 1 lot, cost_basis = harga + biaya",hold(e,0,e.a1)==(1,0,702500+f),str(hold(e,0,e.a1)))
chk("stok bandar turun 1",stock(e,e.a1)==99)
chk("uang bandar naik sebesar pembayaran tim",hc(e)==h0+702500+f)
chk("harga terakhir = 702.500",last(e,e.a1)==702500)
t=q(e,"select price,qty,buyer_fee,seller_fee,taker_side,seller_id is null from trades")[0]
chk("baris trades benar",t==(702500,1,f,0,'buy',True),str(t))
inv(e,"beli market")
# jual market ke bid bandar 697.500
c0=bal(e,0)[0]; r=po(e,0,e.a1,'sell','market',None,1)
f2=fee(697500,1)
chk("market jual 1 lot ke bid bandar 697.500",filled(r)==1 and bal(e,0)[0]==c0+697500-f2 and f2==1744,str(bal(e,0)))
chk("kepemilikan kembali 0 dan cost_basis 0",hold(e,0,e.a1)==(0,0,0),str(hold(e,0,e.a1)))
chk("stok bandar kembali 100",stock(e,e.a1)==100)
chk("harga terakhir turun ke 697.500",last(e,e.a1)==697500)
inv(e,"jual market")

# ================= C. limit: antre, kunci, batal =================
e=setup_ob("t_ob3",20_000_000); setstate(e,'open')
r=po(e,0,e.a1,'buy','limit',700000,2); o1=oid(r)
L=700000+fee(700000,1)
chk("limit beli di dalam spread: antre (open)",ost(r)=='open' and orem(r)==2,str(r))
chk("kunci = (harga + biaya per lot) x 2",bal(e,0)==(20_000_000-2*L,2*L) and L==701750,str(bal(e,0)))
inv(e,"limit antre")
chk("tim lain tidak bisa membatalkan",errmsg(cancel(e,1,o1))=="order_not_found")
r=cancel(e,0,o1)
chk("batal: status cancelled, kunci kembali penuh",r[0] and r[1][0][10]=='cancelled' and bal(e,0)==(20_000_000,0),str(bal(e,0)))
chk("batal ulang -> order_not_open",errmsg(cancel(e,0,o1))=="order_not_open")
chk("batal order tak ada -> order_not_found",errmsg(cancel(e,0,999999))=="order_not_found")
inv(e,"batal")
# limit beli menyilang offer bandar: terisi di harga offer (maker), selisih kunci kembali
r=po(e,0,e.a1,'buy','limit',705000,1)
chk("beli limit 705.000 menyilang offer 702.500: terisi di 702.500",filled(r)==1 and ost(r)=='filled' and last(e,e.a1)==702500)
chk("selisih kunci dikembalikan: saldo hanya berkurang harga maker + biaya",bal(e,0)==(20_000_000-702500-fee(702500,1),0),str(bal(e,0)))
inv(e,"silang")
# limit jual antre mengunci lot
r=po(e,0,e.a1,'sell','limit',710000,1); os_=oid(r)
chk("jual limit antre: lot terkunci",ost(r)=='open' and hold(e,0,e.a1)[:2]==(1,1))
chk("lot terkunci tidak bisa dijual dua kali",errmsg(po(e,0,e.a1,'sell','limit',712500,1))=="insufficient_holdings" and errmsg(po(e,0,e.a1,'sell','market',None,1))=="insufficient_holdings")
cancel(e,0,os_); chk("batal jual: lot terbuka lagi",hold(e,0,e.a1)[:2]==(1,0))
inv(e,"jual antre")

# ================= D. pencocokan antar tim =================
e=setup_ob("t_ob4",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,3)     # A punya 3 lot a3 dari bandar
h=hold(e,0,e.a3); chk("A memegang 3 lot a3",h[0]==3)
rb=po(e,1,e.a3,'buy','limit',150000,3); ob_=oid(rb)   # B antre bid 150.000 (di dalam spread bandar 149.500/150.500)
chk("B antre bid 150.000 x3",ost(rb)=='open')
cA=bal(e,0)[0]; cB=bal(e,1); h0=hc(e); stk=stock(e,e.a3)
ra=po(e,0,e.a3,'sell','limit',150000,1)
fs=fee(150000,1); fb=fee(150000,1)
chk("A jual limit 1 lot @150.000 cocok dengan bid B, order A filled",ost(ra)=='filled' and filled(ra)==1,str(ra))
chk("A menerima harga - biaya jual",bal(e,0)[0]==cA+150000-fs,str(bal(e,0)))
chk("B: kunci turun 1 lot, kepemilikan +1 (cost_basis = harga + biaya)",bal(e,1)[1]==cB[1]-(150000+fee(150000,1)) and hold(e,1,e.a3)==(1,0,150000+fb))
chk("order B partial, sisa 2",q(e,"select status,remaining from orders where id=%s",(ob_,))[0]==('partial',2))
chk("uang bandar naik = total biaya kedua sisi",hc(e)==h0+fs+fb,f"{hc(e)-h0}")
chk("stok bandar tidak berubah oleh jual-beli antar tim",stock(e,e.a3)==stk)
chk("harga terakhir 150.000",last(e,e.a3)==150000)
inv(e,"antar tim")
# prioritas harga lalu waktu
e=setup_ob("t_ob5",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,4)
rB=po(e,1,e.a3,'buy','limit',150000,1); rC=po(e,2,e.a3,'buy','limit',150000,1)
po(e,0,e.a3,'sell','limit',150000,1)
chk("prioritas waktu: bid yang lebih dulu (B) terisi, C tetap antre",q(e,"select status from orders where id=%s",(oid(rB),))[0][0]=='filled' and q(e,"select status from orders where id=%s",(oid(rC),))[0][0]=='open')
e=setup_ob("t_ob6",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,4)
q(e,"update orders set status='cancelled',closed_at=now() where is_house and asset_id=%s and side='buy'",(e.a3,))   # singkirkan bid bandar agar hanya bid tim yang tersedia
rLow=po(e,1,e.a3,'buy','limit',149500,1); rHi=po(e,2,e.a3,'buy','limit',150000,1)
ra=po(e,0,e.a3,'sell','market',None,1)
chk("prioritas harga: bid 150.000 (C) dilayani lebih dulu daripada 149.500 (B), walau B masuk lebih dulu",
    q(e,"select status from orders where id=%s",(oid(rHi),))[0][0]=='filled' and q(e,"select status from orders where id=%s",(oid(rLow),))[0][0]=='open' and last(e,e.a3)==150000)
inv(e,"prioritas")
# self-trade
e=setup_ob("t_ob7",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,2)
rb=po(e,0,e.a3,'buy','limit',150000,1); rs=po(e,0,e.a3,'sell','limit',150000,1)
chk("self-trade: bid dan offer milik tim sama tidak saling mencocokkan",ost(rb)=='open' and ost(rs)=='open' and q(e,"select count(*) from trades where buyer_id=seller_id")[0][0]==0,str((ost(rb),ost(rs))))
po(e,1,e.a3,'buy','market',None,1)
rt=po(e,1,e.a3,'sell','market',None,1)
chk("tim lain bisa mengisi bid itu; order market jual menyapu bid terbaik milik A (150.000)",filled(rt)==1 and last(e,e.a3)==150000)
inv(e,"self-trade")
# partial taker + sisa antre
e=setup_ob("t_ob8",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,2)
rb=po(e,1,e.a3,'buy','limit',150000,1)
rs=po(e,0,e.a3,'sell','limit',150000,2)
chk("jual limit 2 lot: 1 terisi oleh B, sisa 1 antre (partial)",ost(rs)=='partial' and orem(rs)==1 and hold(e,0,e.a3)[:2]==(1,1),str(rs))
inv(e,"partial taker")

# ================= E. market sweep =================
e=setup_ob("t_ob9",200_000_000); setstate(e,'open')
r=po(e,0,e.a1,'buy','market',None,60)
chk("market beli 60 lot: menyapu 5 level (50 lot), sisa 10 dibatalkan",filled(r)==50 and ost(r)=='cancelled' and orem(r)==10,str(r))
chk("harga terakhir = level kelima 712.500",last(e,e.a1)==712500)
chk("persediaan bandar habis di sisi jual: stok 50",stock(e,e.a1)==50)
tot=sum(p*10 for p in (702500,705000,707500,710000,712500)); fees=sum(fee(p,10) for p in (702500,705000,707500,710000,712500))
chk("total bayar = Σ(harga x lot) + biaya per pencocokan",200_000_000-bal(e,0)[0]==tot+fees,f"{200_000_000-bal(e,0)[0]} vs {tot+fees}")
inv(e,"sweep")
# bid bandar yang kosong: jual market tanpa pembeli
r=po(e,0,e.a1,'sell','market',None,50)
chk("market jual 50: bid bandar 5 level x10 = 50 lot semua terisi",filled(r)==50 and last(e,e.a1)==687500,str(r))
r=po(e,0,e.a1,'sell','market',None,1)
chk("sesudah itu tidak ada bid: market jual ditolak karena tak punya lot",errmsg(r)=="insufficient_holdings")
# market tanpa lawan: dibatalkan, kunci kembali
e=setup_ob("t_ob10",50_000_000); setstate(e,'open')
po(e,0,e.a3,'buy','market',None,2)
q(e,"update orders set status='cancelled',closed_at=now() where is_house and side='buy'")
r=po(e,0,e.a3,'sell','market',None,2)
chk("market jual tanpa pembeli: 0 terisi, status cancelled, lot tidak tertahan",filled(r)==0 and ost(r)=='cancelled' and hold(e,0,e.a3)[:2]==(2,0),str(hold(e,0,e.a3)))
inv(e,"market kosong")
# market beli: hanya sebanyak yang mampu dibayar
e=setup_ob("t_ob11",1_000_000); setstate(e,'open')
r=po(e,0,e.a1,'buy','market',None,5)
chk("saldo 1 juta, market beli 5 lot @702.500: hanya 1 lot terbeli, sisa dibatalkan",filled(r)==1 and ost(r)=='cancelled',str(r))
chk("saldo tidak negatif",bal(e,0)[0]==1_000_000-702500-fee(702500,1))
inv(e,"market mampu bayar")

# ================= F. idempotensi =================
e=setup_ob("t_ob12",50_000_000); setstate(e,'open')
rq=rid(); r1=po(e,0,e.a1,'buy','limit',700000,1,r=rq); r2=po(e,0,e.a1,'buy','limit',700000,1,r=rq)
chk("kirim ulang request_id sama: order yang sama, tidak ganda",r1[0] and r2[0] and oid(r1)==oid(r2) and q(e,"select count(*) from orders where request_id=%s",(rq,))[0][0]==1)
chk("kunci tidak ganda",bal(e,0)[1]==701750)
chk("request_id sama untuk parameter beda -> request_id_conflict",errmsg(po(e,0,e.a1,'buy','limit',700000,2,r=rq))=="request_id_conflict")
chk("request_id milik tim lain -> request_id_conflict",errmsg(po(e,1,e.a1,'buy','limit',700000,1,r=rq))=="request_id_conflict")
rq2=rid(); a=po(e,0,e.a1,'buy','market',None,1,r=rq2); b=po(e,0,e.a1,'buy','market',None,1,r=rq2)
chk("market: kirim ulang tidak membeli dua kali",oid(a)==oid(b) and hold(e,0,e.a1)[0]==1)
inv(e,"idempotensi")

# ================= G. status pasar =================
e=setup_ob("t_ob13",50_000_000); setstate(e,'open')
r=po(e,0,e.a1,'buy','limit',700000,1); o1=oid(r)
setstate(e,'paused')
chk("pasar jeda: place_order ditolak",errmsg(po(e,0,e.a1,'buy','market',None,1))=="market_closed")
chk("pasar jeda: cancel_order ditolak",errmsg(cancel(e,0,o1))=="market_closed")
chk("pasar jeda: order tetap antre dan terkunci",bal(e,0)[1]==701750)
setstate(e,'open')
chk("lanjut: order lama tetap ada, bisa dibatalkan",cancel(e,0,o1)[0] is True)
r=po(e,0,e.a1,'buy','limit',700000,2); r2=po(e,1,e.a3,'buy','market',None,2); r3=po(e,1,e.a3,'sell','limit',150000,1)
bn=q(e,"select team_id,net_worth,cash from v_team_net_worth order by team_id")
res=setstate(e,'finished')
chk("selesai: sukses",res[0],str(res))
chk("selesai: semua order antre dibatalkan, kunci kembali",q(e,"select count(*) from orders where status in ('open','partial')")[0][0]==0 and q(e,"select count(*) from teams where locked_cash<>0")[0][0]==0 and q(e,"select count(*) from holdings where locked_qty<>0")[0][0]==0)
chk("selesai: place_order ditolak",errmsg(po(e,0,e.a1,'buy','market',None,1))=="market_closed")
an=q(e,"select team_id,net_worth,cash from v_team_net_worth order by team_id")
chk("net worth tidak berubah oleh pembatalan otomatis",[x[:2] for x in bn]==[x[:2] for x in an])
snap=q(e,"select team_id,net_worth from leaderboard_snapshot order by team_id")
chk("snapshot leaderboard = net worth akhir",snap==[x[:2] for x in an])
inv(e,"selesai")

# ================= H. net worth dan indeks =================
e=setup_ob("t_ob14",50_000_000); setstate(e,'open')
po(e,0,e.a1,'buy','market',None,2); po(e,0,e.a3,'buy','market',None,1)
rr=po(e,0,e.a4,'buy','limit',297000,1) if False else None
po(e,0,e.a4,'buy','limit',299000,1)
nw=q(e,"select cash,locked_cash,net_worth from v_team_net_worth where team_id=%s",(e.teams[0],))[0]
rk=lambda a: q(e,'select coalesce(rank_price,price) from assets where id=%s',(a,))[0][0]
exp=bal(e,0)[0]+bal(e,0)[1]+2*rk(e.a1)+1*rk(e.a3)
chk("net worth = saldo bebas + terkunci + Σ qty x harga terakhir",nw[2]==exp,f"{nw[2]} vs {exp}")
s=call(e,e.teams[0],"select * from get_my_summary()")
chk("get_my_summary: saldo bebas, nilai aset, net worth, terkunci",s[0] and s[1][0][0]==bal(e,0)[0] and s[1][0][3]==bal(e,0)[1] and s[1][0][2]==exp,str(s))
lb=call(e,e.admin,"select * from get_leaderboard()"); chk("leaderboard admin: net worth tim A sama",lb[0] and any(r[2]=='Tim A' and r[5]==exp for r in lb[1]),str(lb[1][:1]))
ix=dict(call(e,e.teams[0],"select scope,value from get_market_index()")[1])
chk("IKC awal bernilai 1000 sebelum ada pergerakan di aset lain (a1,a3 bergerak)",ix['IKC']>0)
ms=call(e,e.disp,"select * from get_market_summary()")
row=[r for r in ms[1] if r[1]=='AAA'][0]
chk("get_market_summary AAA: OHLC/Lot/Val/Avg/Freq dari trades",row[4]==702500 and row[5]==702500 and row[6]==702500 and row[7]==2 and row[8]==1405000 and row[9]==702500 and row[10]==1,str(row))
chk("get_market_summary: tim, admin, display boleh; penjaga dan tanpa profil tidak",call(e,e.teams[0],"select count(*) from get_market_summary()")[0] and call(e,e.admin,"select count(*) from get_market_summary()")[0] and errmsg(call(e,e.g1,"select count(*) from get_market_summary()"))=="forbidden" and errmsg(call(e,e.orphan,"select count(*) from get_market_summary()"))=="forbidden")
# order book
ob=call(e,e.teams[0],"select * from get_order_book(%s)",(e.a1,))
sells=[r for r in ob[1] if r[0]=='sell']; buys=[r for r in ob[1] if r[0]=='buy']
chk("get_order_book: 5 level tiap sisi, offer naik dan bid turun",len(sells)==5 and len(buys)==5 and [r[1] for r in sells]==sorted(r[1] for r in sells) and [r[1] for r in buys]==sorted((r[1] for r in buys),reverse=True),str(ob[1]))
po(e,0,e.a1,'buy','limit',700000,3); ob=call(e,e.teams[0],"select * from get_order_book(%s)",(e.a1,))
lv=[r for r in ob[1] if r[1]==700000][0]
chk("level 700.000 menampilkan lot 3, antrean 1, milik sendiri 3",lv[2]==3 and lv[3]==1 and lv[4]==3,str(lv))
ob2=call(e,e.teams[1],"select * from get_order_book(%s)",(e.a1,)); lv2=[r for r in ob2[1] if r[1]==700000][0]
chk("tim lain melihat lot yang sama tetapi miliknya 0",lv2[2]==3 and lv2[4]==0)
chk("get_order_book ditolak untuk admin, display, penjaga",all(errmsg(call(e,w,"select * from get_order_book(%s)",(e.a1,)))=="forbidden" for w in (e.admin,e.disp,e.g1)))
inv(e,"net worth")

# ================= I. berita menggeser acuan =================
e=setup_ob("t_ob15",50_000_000)
n=mknews(e,[(e.a1,1000),(e.a3,-500),(e.a4,300),(e.a5,200)])
call(e,e.admin,"select admin_set_news_ready(%s,true)",(n,))
setstate(e,'open')
po(e,0,e.a1,'buy','limit',700000,1); po(e,0,e.a1,'buy','market',None,1)
chk("sebelum berita: harga terakhir a1 = 702.500",last(e,e.a1)==702500)
q(e,"select set_config('classmeet.system','on',false)")
live=q(e,"select status from news where id=%s",(n,))[0][0]
chk("berita sudah tayang saat pasar dibuka",live=='live',live)
q(e,"update news set effect_at=now()-interval '1 second' where id=%s",(n,))
res=cycle(e)
chk("siklus menerapkan efek",res.startswith('applied'),res)
chk("acuan a1 +10% = 770.000; harga terakhir dan harga peringkat menyusul",price(e,e.a1)==770000 and last(e,e.a1)==770000 and q(e,'select rank_price from assets where id=%s',(e.a1,))[0][0]==770000)
chk("kuotasi lama bandar dibatalkan; kuotasi baru di sekitar 770.000",
    q(e,"select min(price) from orders where asset_id=%s and is_house and side='sell' and status='open'",(e.a1,))[0][0]==772500 and
    q(e,"select max(price) from orders where asset_id=%s and is_house and side='buy' and status='open'",(e.a1,))[0][0]==767500 and
    q(e,"select count(*) from orders where asset_id=%s and is_house and status in ('open','partial')",(e.a1,))[0][0]==10)
chk("order limit tim tetap antre di harganya",q(e,"select count(*) from orders where team_id=%s and price=700000 and status='open'",(e.teams[0],))[0][0]==1)
chk("batas ARA/ARB ikut bergeser: 770.000 +15% = 885.000 -> dibatasi maks aset 800.000",errmsg(po(e,0,e.a1,'buy','limit',805000,1))=="price_out_of_range" and po(e,1,e.a1,'buy','limit',800000,1)[0])
ix=dict(call(e,e.teams[0],"select scope,value from get_market_index()")[1])
rows=q(e,"select coalesce(last_price,price),base_price,sector from assets")
exp=1000*sum(a/b for a,b,_ in rows)/len(rows)
chk("IKC = 1000 x rata-rata sama rata (harga terakhir / harga awal) atas 8 aset",abs(float(ix['IKC'])-exp)<0.01 and float(ix['IKC'])>1000,f"{ix['IKC']} vs {exp}")
tek=[a/b for a,b,sc in rows if sc=='tek']
chk("indeks sektor tek dihitung dari aset sektornya saja",abs(float(ix['sektor:tek'])-1000*sum(tek)/len(tek))<0.01)
chk("indeks sektor ada",any(k.startswith('sektor:') for k in ix))
inv(e,"berita")
pickle.dump(RES,open("res_ob.pkl","wb"))
print("grup OB1 selesai",len(RES),"cek,",sum(1 for r in RES if not r[1]),"gagal")
