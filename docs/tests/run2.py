from t2 import *
import pickle
def fee_(p,n): return (p*n*25+9999)//10000
# ===== GRUP 2: leaderboard, tick, state, news =====
e=setup(mkdb("t_g2")); T0,T1,T2=e.teams
setstate(e,'open')
for i,amt in enumerate((300000,500000,100000)):
    submit(e,e.g2,e.teams[i],amt)
call(e,T1,"select * from place_order(%s,%s,'buy','market',null,10)",(rid(),e.a1))   # T1 membeli 10 lot dari bandar @10.500 + biaya
for t in (T0,T1,T2,e.g1,e.g2,e.orphan):
    chk("leaderboard ditolak untuk non admin/display",errmsg(call(e,t,"select * from get_leaderboard()"))=="forbidden")
ok,r=call(e,e.disp,"select * from get_leaderboard()")
chk("display melihat leaderboard terurut",ok and [x[0] for x in r]==[1,2,3] and r[0][2]=="Tim B",str(r))
chk("net worth = cash + nilai aset (dan T1 tetap peringkat 1)",ok and r[0][5]==r[0][3]+r[0][4] and r[0][4]==10*10500 and r[0][5]==500000-fee_(10500,10),str(r))
# nilai aset = HARGA TRANSAKSI TERAKHIR: harga terakhir naik 2x menaikkan nilai aset dan net worth
base={x[2]:(x[3],x[4],x[5]) for x in r}
q(e,"update assets set rank_price=coalesce(rank_price,price)*2 where id=%s",(e.a1,))
ok2,r2=call(e,e.disp,"select * from get_leaderboard()")
nb={x[2]:(x[3],x[4],x[5]) for x in r2}
chk("harga terakhir naik 2x: nilai aset tim B naik 2x, tim lain tak berubah",ok2 and nb["Tim B"]==(base["Tim B"][0],base["Tim B"][1]*2,base["Tim B"][0]+base["Tim B"][1]*2) and nb["Tim A"]==base["Tim A"],str(r2))
chk("my_summary memakai harga terakhir yang sama",call(e,T1,"select holdings_value,net_worth from get_my_summary()")[1][0]==(nb["Tim B"][1],nb["Tim B"][2]),"")
q(e,"update assets set rank_price=NULL where id=%s",(e.a1,))
ok,ra=call(e,e.admin,"select * from get_leaderboard()"); chk("admin melihat leaderboard",ok and len(ra)==3)
# seri: dua tim sama net worth & cash -> rank dibagi
q(e,"update teams set cash=300000 where id in (%s,%s)",(T0,T2))
ok,r=call(e,e.disp,"select rank,team_name from get_leaderboard() order by rank, team_name"); chk("seri berbagi peringkat",ok and [x[0] for x in r]==[1,2,2],str(r))
q(e,"update teams set cash=300000 where id=%s",(T0,)); q(e,"update teams set cash=100000 where id=%s",(T2,))
call(e,e.admin,"select admin_set_leaderboard_visible(false)")
chk("disembunyikan: display -> leaderboard_hidden",errmsg(call(e,e.disp,"select * from get_leaderboard()"))=="leaderboard_hidden")
chk("disembunyikan: admin tetap bisa",call(e,e.admin,"select * from get_leaderboard()")[0])
chk("set_visible: tim ditolak",errmsg(call(e,T0,"select admin_set_leaderboard_visible(true)"))=="forbidden")
call(e,e.admin,"select admin_set_leaderboard_visible(true)")
chk("freeze: tim ditolak",errmsg(call(e,T0,"select admin_freeze_leaderboard()"))=="forbidden")
chk("freeze ok",call(e,e.admin,"select admin_freeze_leaderboard()")[0])
before=call(e,e.disp,"select team_id,net_worth from get_leaderboard() order by team_id")[1]
submit(e,e.g2,T2,900000)
after=call(e,e.disp,"select team_id,net_worth from get_leaderboard() order by team_id")[1]
chk("beku: display tetap melihat snapshot",before==after)
live=call(e,e.admin,"select team_id,net_worth from get_leaderboard() order by team_id")[1]
chk("beku: admin melihat data langsung",live!=after)
call(e,e.admin,"select admin_unfreeze_leaderboard()")
chk("unfreeze: display melihat data langsung lagi",call(e,e.disp,"select team_id,net_worth from get_leaderboard() order by team_id")[1]==live)
chk("snapshot kosong setelah unfreeze",q(e,"select count(*) from leaderboard_snapshot")[0][0]==0)

# --- jeda
setstate(e,'paused')
chk("paused: beli -> market_closed",errmsg(call(e,T0,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1)))=="market_closed")
ok,res=submit(e,e.g2,T0,1000); chk("paused: pemberian hadiah tetap boleh dan langsung masuk",ok and cash(e,0)>=1000)
chk("paused: paused_at terisi",q(e,"select paused_at is not null from game_settings")[0][0])
setstate(e,'open')
chk("resume: paused_at kosong lagi",q(e,"select paused_at is null from game_settings")[0][0])

# --- transisi status
chk("open->setup ditolak",errmsg(setstate(e,'setup'))=="invalid_state_transition")
chk("open->open ditolak",errmsg(setstate(e,'open'))=="invalid_state_transition")
chk("tim tidak boleh ubah status",errmsg(call(e,T0,"select admin_set_game_state('paused')"))=="forbidden")
ok,res=submit(e,e.g2,T1,2000)
chk("finish -> sukses (tidak ada berita live, tidak ada antrean hadiah)",setstate(e,'finished')[0])
chk("finish: snapshot terisi & frozen_at",q(e,"select count(*) from leaderboard_snapshot")[0][0]==3 and q(e,"select leaderboard_frozen_at is not null from game_settings")[0][0])
chk("finished: beli -> market_closed",errmsg(call(e,T0,"select * from place_order(%s,%s,'buy','market',null,1)",(rid(),e.a1)))=="market_closed")
chk("finished: hadiah -> game_not_active",errmsg(submit(e,e.g2,T0,1000))=="game_not_active")
chk("finished: hadiah ditolak, saldo tidak berubah",(lambda c0:(errmsg(submit(e,e.g2,T0,777))=="game_not_active" and cash(e,0)==c0))(cash(e,0)))
chk("finished: save_news ditolak (terkunci sejak dibuka)",errmsg(savenews(e,[(e.a1,300),(e.a2,300),(e.a3,300),(e.a4,300)],"F"))=="game_started_locked")
chk("finished: process_news_cycle -> idle",cycle(e)=="idle")
chk("finished->open ditolak",errmsg(setstate(e,'open'))=="invalid_state_transition")
chk("display melihat snapshot beku",call(e,e.disp,"select count(*) from get_leaderboard()")[1][0][0]==3)

pickle.dump(RES,open("res2.pkl","wb")); print("grup2 selesai")
