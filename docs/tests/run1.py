from t2 import *
# template db
c=admin_conn("postgres"); cu=c.cursor()
cu.execute("drop database if exists ctest_tpl"); cu.execute("create database ctest_tpl"); c.close()
import subprocess
r=subprocess.run(["psql","-h",HOST,"-p",str(PORT),"-U","postgres","-d","ctest_tpl","-v","ON_ERROR_STOP=1","-q","-f","full2.sql"],capture_output=True,text=True)
chk("migrasi bersih ke DB kosong",r.returncode==0,r.stderr[-300:])

# ===== GRUP 1: alur dasar, QR, pengajuan, ACC =====
e=setup(mkdb("t_g1"))
T0,T1,T2=e.teams
chk("modal awal tim = 0",cash(e,0)==0)
chk("beli saat setup -> market_closed",errmsg(call(e,T0,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1)))=="market_closed")
chk("admin: setup->open",setstate(e,'open')[0])
chk("saat open: tidak ada jeda berita tertunda & tidak paused",q(e,"select news_next_allowed_at is null and paused_at is null from game_settings")[0][0])
chk("beli dengan saldo 0 -> insufficient_cash",errmsg(call(e,T0,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1)))=="insufficient_cash")
chk("stok bandar tidak berubah setelah gagal beli",q(e,"select stock from assets where id=%s",(e.a1,))[0][0]==100)

ok,r=call(e,e.g1,"select * from resolve_team_qr(%s)",(str(qr(e,0)),))
chk("resolve QR -> id+nama tim",ok and r[0][0]==T0 and r[0][1]=="Tim A",str(r))
chk("resolve QR -> saldo tim ikut (0 untuk tim baru)",ok and len(r[0])==3 and r[0][2]==0,str(r))
chk("penjaga tetap tidak bisa membaca tabel teams langsung",len(call(e,e.g1,"select cash from teams")[1] or [])==0)
ok,r=call(e,e.g1,"select * from resolve_team_code(%s)",("  aaaaaa ",))
chk("resolve kode cadangan (lowercase+spasi)",ok and r[0][0]==T0,str(r))
chk("QR acak -> team_not_found",errmsg(call(e,e.g1,"select * from resolve_team_qr(%s)",(rid(),)))=="team_not_found")
chk("tim tidak boleh resolve QR",errmsg(call(e,T0,"select * from resolve_team_qr(%s)",(str(qr(e,1)),)))=="forbidden")
chk("user tanpa profil tidak boleh resolve",errmsg(call(e,e.orphan,"select * from resolve_team_qr(%s)",(str(qr(e,1)),)))=="forbidden")
chk("display tidak boleh resolve",errmsg(call(e,e.disp,"select * from resolve_team_qr(%s)",(str(qr(e,1)),)))=="forbidden")

chk("pos tutup -> post_closed",errmsg(submit(e,e.g1,T0,50000))=="post_closed")
chk("pos tutup: saldo tidak berubah",cash(e,0)==0)
q(e,"update posts set is_open=true where id=%s",(e.p1,))
r1=rid(); ok,res=submit(e,e.g1,T0,50000,r1); pid=res[0][0] if ok else None
chk("penjaga memberi hadiah -> sukses",ok,str(res))
chk("SALDO LANGSUNG BERTAMBAH tanpa persetujuan (50000)",cash(e,0)==50000)
ok2,res2=submit(e,e.g1,T0,50000,r1)
chk("kirim ulang request_id sama -> id sama, tidak ganda",ok2 and res2[0][0]==pid and q(e,"select count(*) from payouts")[0][0]==1)
chk("kirim ulang: saldo tetap 50000",cash(e,0)==50000)
chk("request_id sama nominal beda -> request_id_conflict",errmsg(submit(e,e.g1,T0,60000,r1))=="request_id_conflict")
chk("request_id sama tim beda -> request_id_conflict",errmsg(submit(e,e.g1,T1,50000,r1))=="request_id_conflict")
chk("nominal 0 -> invalid_amount",errmsg(submit(e,e.g1,T0,0))=="invalid_amount")
chk("nominal negatif -> invalid_amount",errmsg(submit(e,e.g1,T0,-5))=="invalid_amount")
chk("nominal null -> invalid_amount",errmsg(call(e,e.g1,"select award_payout(%s,%s,null)",(rid(),T0)))=="invalid_amount")
chk("tim tidak dikenal -> team_not_found",errmsg(submit(e,e.g1,rid(),1000))=="team_not_found")
chk("tim tidak boleh memberi hadiah",errmsg(submit(e,T0,T0,1000))=="forbidden")
chk("admin tidak boleh memberi hadiah",errmsg(submit(e,e.admin,T0,1000))=="forbidden")
chk("display tidak boleh memberi hadiah",errmsg(submit(e,e.disp,T0,1000))=="forbidden")
chk("tanpa profil tidak boleh memberi hadiah",errmsg(submit(e,e.orphan,T0,1000))=="forbidden")
chk("penolakan tidak mengubah saldo",cash(e,0)==50000)
ok,r=call(e,e.g1,"select count(*) from audit_log where action='payout_awarded'"); 
chk("audit payout_awarded tercatat",q(e,"select count(*) from audit_log where action='payout_awarded'")[0][0]==1)
chk("sistem ACC sudah hilang: tabel payout_requests tidak ada",q(e,"select to_regclass('public.payout_requests') is null")[0][0])
chk("sistem ACC sudah hilang: admin_review_payout tidak ada",q(e,"select to_regproc('public.admin_review_payout') is null")[0][0])
chk("sistem ACC sudah hilang: submit_payout_request tidak ada",q(e,"select to_regproc('public.submit_payout_request') is null")[0][0])

# RLS & hak
ok,r=call(e,T0,"select count(*) from payouts"); chk("tim melihat hadiah miliknya",ok and r[0][0]==1)
ok,r=call(e,T1,"select count(*) from payouts"); chk("tim lain tidak melihat",ok and r[0][0]==0)
ok,r=call(e,e.g1,"select count(*) from payouts"); chk("penjaga pos 1 melihat",ok and r[0][0]==1)
ok,r=call(e,e.g2,"select count(*) from payouts"); chk("penjaga pos 2 tidak melihat",ok and r[0][0]==0)
ok,r=call(e,e.admin,"select count(*) from payouts"); chk("admin melihat semua",ok and r[0][0]==1)
ok,r=call(e,e.g1,"select count(*) from teams"); chk("penjaga tidak bisa membaca tabel teams",ok and r[0][0]==0)
ok,r=call(e,e.disp,"select count(*) from teams"); chk("display tidak bisa membaca teams",ok and r[0][0]==0)
ok,r=call(e,T0,"select count(*) from teams"); chk("tim hanya melihat baris sendiri",ok and r[0][0]==1)
ok,r=call(e,T0,"select qr_token from teams"); chk("tim bisa baca qr_token sendiri",ok and len(r)==1)
chk("tulis langsung ke teams ditolak",not call(e,T0,"update teams set cash=999999999 where id=%s",(T0,))[0])
chk("insert langsung payouts ditolak",not call(e,e.g1,"insert into payouts(request_id,post_id,team_id,guard_id,amount) values (%s,%s,%s,%s,1)",(rid(),e.p1,T0,e.g1))[0])
chk("update payouts oleh klien ditolak",not call(e,e.admin,"update payouts set amount=1")[0])
chk("anon tidak bisa panggil place_order",not call(e,None,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1),role="anon")[0])
chk("anon tidak bisa baca assets",not call(e,None,"select * from assets",role="anon")[0])
ok,r=call(e,T0,"select count(*) from v_team_net_worth"); chk("view v_team_net_worth ditolak untuk tim",not ok,str(r))
ok,r=call(e,e.disp,"select count(*) from v_team_net_worth"); chk("view v_team_net_worth ditolak untuk display",not ok)
ok,r=call(e,T0,"select count(*) from leaderboard_snapshot"); chk("snapshot ditolak untuk klien",not ok)
ok,r=call(e,T0,"select count(*) from news_effects"); chk("news_effects: tim tidak melihat",(not ok) or r[0][0]==0)

ok,r=call(e,e.g1,"select * from get_post_payouts()"); chk("get_post_payouts penjaga: 1 baris + nama tim + nominal",ok and len(r)==1 and r[0][1]=="Tim A" and r[0][2]==50000,str(r))
ok,r=call(e,e.g2,"select * from get_post_payouts()"); chk("get_post_payouts pos lain kosong",ok and r==[])
chk("tim tidak boleh get_post_payouts",errmsg(call(e,T0,"select * from get_post_payouts()"))=="forbidden")

# pemberian hadiah bersamaan dengan request_id sama: saldo bertambah sekali
okk,res=submit(e,e.g1,T1,70000,r2:=rid())
outs=par([lambda:submit(e,e.g1,T1,70000,r2) for _ in range(10)])
chk("10 kirim request_id sama bersamaan -> semua sukses/idempotent",all(o[0] for o in outs),str(outs))
chk("10 kirim bersamaan -> saldo bertambah SEKALI (70000)",cash(e,1)==70000,str(cash(e,1)))
chk("hanya satu baris payouts untuk request_id itu",q(e,"select count(*) from payouts where request_id=%s",(r2,))[0][0]==1)

# tanpa batas kunjungan dan tanpa batas nominal
for _ in range(6): submit(e,e.g1,T2,5000)
chk("tanpa batas kunjungan: 6 hadiah ke tim+pos sama semua diterima",q(e,"select count(*) from payouts where team_id=%s and post_id=%s",(T2,e.p1))[0][0]==6)
chk("saldo tim C akurat setelah banyak hadiah",cash(e,2)==30000)
okb,_=submit(e,e.g1,T2,10**12)
chk("tanpa batas nominal: 1 triliun diterima (diputuskan: tanpa pengaman)",okb and cash(e,2)==30000+10**12)
call(e,e.admin,"select admin_adjust_cash(%s,%s,'koreksi uji')",(T2,-10**12))
chk("admin_adjust_cash dapat mengoreksi hadiah yang salah",cash(e,2)==30000)

# order book dasar (rincian lengkap di run_ob.py / run_ob2.py)
def mbuy(t,a,n,r=None): return call(e,t,"select * from place_order(%s,%s,'buy','market',null,%s)",(r or rid(),a,n))
def msell(t,a,n,r=None): return call(e,t,"select * from place_order(%s,%s,'sell','market',null,%s)",(r or rid(),a,n))
def fl(r): return r[1][0][7]-r[1][0][8]
def hq(t,a): return q(e,"select coalesce(sum(qty),0) from holdings where team_id=%s and asset_id=%s",(t,a))[0][0]
ok,r=call(e,e.admin,"select admin_adjust_cash(%s,%s,'modal uji')",(T0,2_000_000_000)); chk("admin_adjust_cash tambah",ok and r[0][0]==2_000_050_000,str(r))
r=mbuy(T0,e.a1,11); chk("beli market 11 lot sukses (tidak ada batas pegang)",r[0] and fl(r)==11,str(r))
chk("holdings = 11",hq(T0,e.a1)==11)
r=msell(T0,e.a1,5); chk("jual market 5 lot ke bid bandar",r[0] and fl(r)==5,str(r))
outs=par([lambda:mbuy(T0,e.a1,1) for _ in range(8)])
chk("8 beli 1 lot bersamaan semuanya terisi (persediaan bandar cukup)",all(o[0] and fl(o)==1 for o in outs),str(outs))
chk("holdings = 14",hq(T0,e.a1)==14)
r=mbuy(T1,e.a1,1); chk("tim lain tidak terpengaruh (T1 beli 1 sukses, holdings 1)",r[0] and hq(T1,e.a1)==1)
r=msell(T0,e.a1,7); chk("jual 7 (sisa 7)",r[0] and fl(r)==7,str(r))
r=mbuy(T0,e.a2,3); chk("aset tanpa kuotasi bandar (band sempit): beli market 0 terisi, dibatalkan, saldo utuh",r[0] and fl(r)==0 and r[1][0][10]=='cancelled',str(r))
q(e,"update assets set is_active=false where id=%s",(e.a8,))
chk("aset nonaktif -> asset_not_found",errmsg(mbuy(T0,e.a8,1))=="asset_not_found")
q(e,"update assets set is_active=true where id=%s",(e.a8,))
chk("jual melebihi kepemilikan -> insufficient_holdings",errmsg(msell(T0,e.a1,8))=="insufficient_holdings")
chk("qty 0 -> invalid_input",errmsg(mbuy(T0,e.a1,0))=="invalid_input")
ok,r=call(e,T0,"select * from get_my_summary()"); chk("get_my_summary tim",ok and r[0][2]==r[0][0]+r[0][1]+r[0][3],str(r))
chk("display tidak boleh get_my_summary",errmsg(call(e,e.disp,"select * from get_my_summary()"))=="forbidden")
rr=rid(); mbuy(T0,e.a1,2,rr); b4=cash(e,0)
ok,r=mbuy(T0,e.a1,2,rr); chk("retry beli idempotent (saldo tak berubah)",ok and cash(e,0)==b4)
chk("request_id dipakai aksi lain -> conflict",errmsg(mbuy(T0,e.a1,3,rr))=="request_id_conflict")
chk("tim lain pakai request_id itu -> conflict",errmsg(mbuy(T1,e.a1,2,rr))=="request_id_conflict")

# koreksi saldo / harga manual / QR
chk("adjust: di bawah nol -> insufficient_cash",errmsg(call(e,e.admin,"select admin_adjust_cash(%s,%s,'x')",(T1,-10**12)))=="insufficient_cash")
chk("adjust: alasan kosong -> invalid_input",errmsg(call(e,e.admin,"select admin_adjust_cash(%s,5,'  ')",(T1,)))=="invalid_input")
chk("adjust: tim ditolak",errmsg(call(e,T1,"select admin_adjust_cash(%s,5,'x')",(T1,)))=="forbidden")
chk("admin_set_price dihapus: fungsi tidak ada",not call(e,e.admin,"select admin_set_price(%s,12000,'uji')",(e.a1,))[0])
chk("admin_run_news_cycle & admin_queue_news dihapus",not call(e,e.admin,"select admin_run_news_cycle()")[0] and not call(e,e.admin,"select admin_queue_news(%s)",(rid(),))[0])
def raw(sql,params=()):
    c=admin_conn(e.db,sys=False)
    try:
        c.cursor().execute(sql,params); return True,None
    except psycopg2.Error as ex: return False,(ex.pgerror or str(ex)).split("\n")[0]
    finally: c.close()
for nm,sql in (("harga","update assets set price=price+100"),("batas bawah","update assets set min_price=min_price+1"),("batas atas","update assets set max_price=max_price+1"),("nonaktifkan","update assets set is_active=false"),("aset baru","insert into assets(symbol,name,sector,price,min_price,max_price,stock) values ('ZZZ','z','z',1000,500,2000,1)"),("hapus aset","delete from assets"),("price_history","insert into price_history(asset_id,price,reason) select id,1,'manual: x' from assets limit 1"),("kumpulan berita","insert into news(title,body,created_by) values ('a','b',(select id from profiles limit 1))"),("pengaturan efek","update game_settings set max_effect_bps=9000"),("jeda berita","update game_settings set news_delay_min_minutes=1")):
    ok,m=raw(sql); chk("terkunci sesudah game dibuka: "+nm,(not ok) and "game_started_locked" in m,str(m))
ok,m=raw("update assets set stock=stock where id=%s",(e.a1,)); chk("stok tetap boleh berubah (tidak terkunci)",ok,str(m))
ok,m=raw("update game_settings set paused_at=paused_at"); chk("status game tetap boleh diubah",ok,str(m))
chk("admin: save_news sesudah dibuka -> game_started_locked",errmsg(call(e,e.admin,"select admin_save_news(null,'a','b','[]'::jsonb)"))=="game_started_locked")
chk("admin: set_news_ready sesudah dibuka -> game_started_locked",errmsg(call(e,e.admin,"select admin_set_news_ready(%s,true)",(rid(),)))=="game_started_locked")
chk("admin tidak bisa membaca news / news_effects sesudah dibuka",call(e,e.admin,"select count(*) from news")[1][0][0]==0 and call(e,e.admin,"select count(*) from news_effects")[1][0][0]==0)
chk("started_at terisi sekali",q(e,"select started_at is not null from game_settings")[0][0])
old=str(qr(e,1)); ok,new=call(e,e.admin,"select admin_rotate_team_qr(%s)",(T1,))
chk("rotate QR: token baru",ok and str(new[0][0])!=old)
chk("rotate QR: token lama mati",errmsg(call(e,e.g1,"select * from resolve_team_qr(%s)",(old,)))=="team_not_found")
chk("rotate QR: token baru hidup",call(e,e.g1,"select * from resolve_team_qr(%s)",(str(new[0][0]),))[0])
chk("rotate QR: tim ditolak",errmsg(call(e,T1,"select admin_rotate_team_qr(%s)",(T1,)))=="forbidden")
# Realtime publication
pubs={r[0] for r in q(e,"select tablename from pg_publication_tables where pubname='supabase_realtime'")}
chk("publikasi realtime = assets,news_feed,game_settings,payouts,posts",pubs=={"assets","news_feed","game_settings","payouts","posts"},str(pubs))

# hak eksekusi fungsi internal
chk("authenticated tidak bisa process_news_cycle",not call(e,e.admin,"select process_news_cycle()")[0])
chk("authenticated tidak bisa check_news_effects",not call(e,e.admin,"select check_news_effects(gen_random_uuid())")[0])
chk("authenticated tidak bisa freeze_internal",not call(e,e.admin,"select freeze_leaderboard_internal()")[0])
chk("anon tidak bisa get_leaderboard",not call(e,None,"select * from get_leaderboard()",role="anon")[0])

# kekekalan uang & stok
tot=q(e,"select coalesce(sum(cash+locked_cash),0) from teams")[0][0]+q(e,"select house_cash from game_settings")[0][0]
ap=q(e,"select coalesce(sum(amount),0) from payouts")[0][0]
adj=q(e,"select coalesce(sum((payload->>'delta')::bigint),0) from audit_log where action='adjust_cash'")[0][0]
chk("KEKEKALAN UANG: Σ(cash+terkunci) + uang bandar = Σpayouts + adjust",tot==ap+adj,f"{tot} vs {ap+adj}")
for a0,a in e.init.items():
    s=q(e,"select stock from assets where id=%s",(a0,))[0][0]; h=q(e,"select coalesce(sum(qty),0) from holdings where asset_id=%s",(a0,))[0][0]
    chk("KEKEKALAN STOK "+str(a),s+h==a,f"{s}+{h}")
print("grup1 selesai")
import pickle; pickle.dump(RES,open("res1.pkl","wb"))
