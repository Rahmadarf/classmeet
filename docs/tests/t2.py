import psycopg2, threading, uuid, random, sys, time, traceback
HOST="/tmp"; PORT=54329
RES=[]  # (name, ok, detail)
def admin_conn(db,sys=True):
    """Superuser. sys=True menyalakan penanda sistem (uji boleh mengatur waktu/harga); sys=False meniru akses tanpa penanda."""
    c=psycopg2.connect(host=HOST,port=PORT,user="postgres",dbname=db); c.autocommit=True
    if sys: c.cursor().execute("select set_config('classmeet.system','on',false)")
    return c
def mkdb(name):
    c=admin_conn("postgres")
    cur=c.cursor(); cur.execute(f"drop database if exists {name}"); cur.execute(f"create database {name} template ctest_tpl"); c.close()
    return name
class Env: pass
def setup(db):
    e=Env(); e.db=db; e.su=admin_conn(db); cur=e.su.cursor(); cur.execute("select set_config('classmeet.system','on',false)")
    def user(role,name,disp=None):
        i=str(uuid.uuid4()); cur.execute("insert into auth.users(id) values (%s)",(i,))
        if role: cur.execute("insert into profiles(id,username,role,display_name) values (%s,%s,%s,%s)",(i,name,role,disp or name))
        return i
    e.admin=user('admin','admin1'); e.admin2=user('admin','admin2')
    e.g1=user('guard','guard1'); e.g2=user('guard','guard2')
    e.disp=user('display','layar'); e.orphan=user(None,'x')
    e.teams=[]
    for n,code in (("Tim A","AAAAAA"),("Tim B","BBBBBB"),("Tim C","CCCCCC")):
        i=user('team','t_'+code.lower(),n); cur.execute("insert into teams(id,name,short_code) values (%s,%s,%s)",(i,n,code)); e.teams.append(i)
    e.p1=str(uuid.uuid4()); e.p2=str(uuid.uuid4())
    cur.execute("insert into posts(id,name,location,guard_id,is_open) values (%s,'Pos1','Aula',%s,false),(%s,'Pos2','Lapangan',%s,true)",(e.p1,e.g1,e.p2,e.g2))
    defs=[("AAA","tek",10000,1000,100000,100,10),("BBB","tek",1000,500,5000,5,10),("CCC","food",20000,5000,50000,50,10),
          ("DDD","food",5000,1000,100000,80,10),("EEE","tek",8000,1000,100000,60,8),("FFF","food",30000,5000,100000,20,7),
          ("GGG","tek",15000,1000,100000,30,7),("HHH","food",2500,500,100000,200,10)]
    e.assets=[]; e.init={}
    for sym,sec,pr,mn,mx,st,mh in defs:
        i=str(uuid.uuid4()); e.assets.append(i); e.init[i]=st
        cur.execute("insert into assets(id,symbol,name,sector,price,min_price,max_price,stock) values (%s,%s,%s,%s,%s,%s,%s,%s)",(i,sym,'Aset '+sym,sec,pr,mn,mx,st))
    e.a1,e.a2,e.a3,e.a4,e.a5,e.a6,e.a7,e.a8=e.assets
    return e
def call(e,uid,sql,params=(),role="authenticated"):
    c=psycopg2.connect(host=HOST,port=PORT,user="postgres",dbname=e.db)
    try:
        cur=c.cursor()
        cur.execute(f"set role {role}")
        if uid: cur.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid,))
        cur.execute(sql,params)
        try: r=cur.fetchall()
        except psycopg2.ProgrammingError: r=None
        c.commit(); return True,r
    except psycopg2.Error as ex:
        c.rollback(); msg=(ex.pgerror or str(ex)).split("\n")[0].replace("ERROR:  ","")
        return False,(ex.pgcode,msg)
    finally: c.close()
def q(e,sql,params=()):
    cur=e.su.cursor(); cur.execute(sql,params)
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return None
def chk(name,cond,detail=""):
    RES.append((name,bool(cond),detail))
    if not cond: print("FAIL:",name,detail)
def errmsg(r): return None if r[0] else r[1][1]
def rid(): return str(uuid.uuid4())
def tid(e,i): return e.teams[i]
def qr(e,i): return q(e,"select qr_token from teams where id=%s",(e.teams[i],))[0][0]
def cash(e,i): return q(e,"select cash from teams where id=%s",(e.teams[i],))[0][0]
def setstate(e,s,force=False):
    return call(e,e.admin,"select admin_set_game_state(%s::game_state)",(s,))
def setprice(e,a,p):
    """Uji: simulasi 'harga bergeser' lewat superuser dengan penanda sistem (panitia sendiri tidak punya jalur ini)."""
    q(e,"select set_config('classmeet.system','on',false)"); q(e,"update assets set price=%s where id=%s",(p,a))
def submit(e,guard,team,amt,r=None,note=None):
    return call(e,guard,"select (award_payout(%s,%s,%s,%s)).id",(r or rid(),team,amt,note))
def par(fns):
    out=[None]*len(fns); ths=[]
    def w(i,f):
        try: out[i]=f()
        except Exception as ex: out[i]=(False,("py",repr(ex)))
    for i,f in enumerate(fns): ths.append(threading.Thread(target=w,args=(i,f)))
    [t.start() for t in ths]; [t.join() for t in ths]; return out

def effs(pairs): 
    import json
    return json.dumps([{"asset_id":a,"pct_bps":p} for a,p in pairs])
def savenews(e,pairs,title="Berita",body="isi",who=None,nid=None):
    return call(e,who or e.admin,"select admin_save_news(%s,%s,%s,%s::jsonb)",(nid,title,body,effs(pairs)))
def mknews(e,pairs,title="Berita"):
    ok,r=savenews(e,pairs,title); assert ok,r; return r[0][0]
def cycle(e):
    c=admin_conn(e.db); cur=c.cursor(); cur.execute("select process_news_cycle()"); r=cur.fetchone()[0]; c.close(); return r
def price(e,a): return q(e,"select price from assets where id=%s",(a,))[0][0]
def nstatus(e,n): return q(e,"select status from news where id=%s",(n,))[0][0]
