from t2 import *
import pickle, random, json, threading, time
ALLOWED={"insufficient_cash","insufficient_holdings","price_out_of_range","invalid_tick","order_not_open","order_not_found","market_closed"}
TICK=lambda p: 500 if p<200000 else (1000 if p<500000 else 2500)
def fee(p,n,bps=25): return (p*n*bps+9999)//10000

def setup_ob(name,fund=0):
    e=setup(mkdb(name))
    # aset berharga realistis: a1 700.000 (fraksi 2.500), a3 150.000 (500), a4 300.000 (1.000)
    q(e,"update assets set price=700000,min_price=110000,max_price=800000,stock=100 where id=%s",(e.a1,))
    q(e,"update assets set price=150000,min_price=50000,max_price=400000,stock=50 where id=%s",(e.a3,))
    q(e,"update assets set price=300000,min_price=100000,max_price=600000,stock=80 where id=%s",(e.a4,))
    e.init={a:q(e,"select stock from assets where id=%s",(a,))[0][0] for a in e.assets}
    if fund:
        for t in e.teams: call(e,e.admin,"select admin_adjust_cash(%s,%s,'modal uji')",(t,fund))
    return e
def po(e,i,a,side,kind,price,qty,r=None,who=None):
    return call(e,who or e.teams[i],"select * from place_order(%s,%s,%s,%s,%s,%s)",(r or rid(),a,side,kind,price,qty))
# kolom orders: 0 id,1 request_id,2 team_id,3 asset_id,4 side,5 kind,6 price,7 qty,8 remaining,9 lock_per_lot,10 status
def oid(r): return r[1][0][0] if r[0] else None
def ost(r): return r[1][0][10] if r[0] else None
def orem(r): return r[1][0][8] if r[0] else None
def filled(r): return (r[1][0][7]-r[1][0][8]) if r[0] else None
def cancel(e,i,o): return call(e,e.teams[i],"select * from cancel_order(%s)",(o,))
def bal(e,i): return q(e,"select cash,locked_cash from teams where id=%s",(e.teams[i],))[0]
def hold(e,i,a):
    r=q(e,"select qty,locked_qty,cost_basis from holdings where team_id=%s and asset_id=%s",(e.teams[i],a)); return r[0] if r else (0,0,0)
def hc(e): return q(e,"select house_cash from game_settings")[0][0]
def last(e,a): return q(e,"select last_price from assets where id=%s",(a,))[0][0]
def stock(e,a): return q(e,"select stock from assets where id=%s",(a,))[0][0]
def inv(e,tag):
    tot=q(e,"select coalesce(sum(cash+locked_cash),0) from teams")[0][0]
    adj=q(e,"select coalesce(sum((payload->>'delta')::bigint),0) from audit_log where action='adjust_cash'")[0][0]
    ap=q(e,"select coalesce(sum(amount),0) from payouts")[0][0]
    chk(f"[{tag}] uang kekal: uang tim + uang bandar = modal yang masuk",tot+hc(e)==adj+ap,f"{tot}+{hc(e)} vs {adj+ap}")
    bad=[]
    for a,n in e.init.items():
        s=stock(e,a); h=q(e,"select coalesce(sum(qty),0) from holdings where asset_id=%s",(a,))[0][0]
        if s+h!=n or s<0: bad.append((a[:4],s,h,n))
    chk(f"[{tag}] unit kekal: stok bandar + milik tim = stok awal",not bad,str(bad))
    bad=q(e,"""select t.id from teams t where t.locked_cash <> coalesce((select sum(lock_per_lot*remaining) from orders o
              where o.team_id=t.id and o.side='buy' and o.status in ('open','partial')),0)""")
    chk(f"[{tag}] saldo terkunci = jumlah kunci order beli antre",not bad,str(bad))
    bad=q(e,"""select h.team_id,h.asset_id from holdings h where h.locked_qty <> coalesce((select sum(remaining) from orders o
              where o.team_id=h.team_id and o.asset_id=h.asset_id and o.side='sell' and o.status in ('open','partial')),0)""")
    chk(f"[{tag}] lot terkunci = jumlah order jual antre",not bad,str(bad))
    bad=q(e,"""select a.id from assets a where coalesce((select sum(remaining) from orders o where o.asset_id=a.id and o.is_house
              and o.side='sell' and o.status in ('open','partial')),0) > a.stock""")
    chk(f"[{tag}] offer bandar tidak melebihi persediaan",not bad,str(bad))
    bad=q(e,"""select 1 from orders b join orders s on s.asset_id=b.asset_id and b.side='buy' and s.side='sell'
              and b.status in ('open','partial') and s.status in ('open','partial') and b.price>=s.price
              and b.team_id is distinct from s.team_id""")
    chk(f"[{tag}] tidak ada order silang antar pihak berbeda",not bad,str(len(bad)))
    chk(f"[{tag}] saldo dan lot tidak negatif",q(e,"select count(*) from teams where cash<0 or locked_cash<0")[0][0]==0 and q(e,"select count(*) from holdings where qty<0 or locked_qty<0 or locked_qty>qty")[0][0]==0)
    chk(f"[{tag}] qty=0 => cost_basis=0",q(e,"select count(*) from holdings where qty=0 and cost_basis<>0")[0][0]==0)


def ledger(e,tag):
    """Bangun ulang saldo dan kepemilikan SETIAP tim dari tabel trades, lalu bandingkan dengan keadaan sebenarnya."""
    bad=[];badu=[]
    for t in e.teams:
        adj=q(e,"select coalesce(sum((payload->>'delta')::bigint),0) from audit_log where action='adjust_cash' and payload->>'team_id'=%s",(t,))[0][0]
        adj+=q(e,"select coalesce(sum(amount),0) from payouts where team_id=%s",(t,))[0][0]
        buys=q(e,"select coalesce(sum(price*qty+buyer_fee),0) from trades where buyer_id=%s",(t,))[0][0]
        sells=q(e,"select coalesce(sum(price*qty-seller_fee),0) from trades where seller_id=%s",(t,))[0][0]
        have=q(e,"select cash+locked_cash from teams where id=%s",(t,))[0][0]
        if have!=adj-buys+sells: bad.append((t[:4],have,adj-buys+sells))
        for a in e.assets:
            b=q(e,"select coalesce(sum(qty),0) from trades where buyer_id=%s and asset_id=%s",(t,a))[0][0]
            s_=q(e,"select coalesce(sum(qty),0) from trades where seller_id=%s and asset_id=%s",(t,a))[0][0]
            if hold(e,[x for x in e.teams].index(t),a)[0]!=b-s_: badu.append((t[:4],a[:4]))
    chk(f"[{tag}] saldo tiap tim = modal + hadiah - beli + jual (dibangun ulang dari trades)",not bad,str(bad))
    chk(f"[{tag}] kepemilikan tiap tim = Σ beli - Σ jual dari trades",not badu,str(badu))
    # sifat tiap trade
    v=q(e,"""select t.id from trades t join orders b on b.id=t.buy_order_id join orders s on s.id=t.sell_order_id
             where (b.kind='limit' and b.price < t.price) or (s.kind='limit' and s.price > t.price)
                or t.price <> case when t.taker_side='buy' then s.price else b.price end
                or (t.buyer_id is not null and t.buyer_fee <> (t.price*t.qty*25+9999)/10000)
                or (t.seller_id is not null and t.seller_fee <> (t.price*t.qty*25+9999)/10000)
                or (t.buyer_id is null and t.buyer_fee<>0) or (t.seller_id is null and t.seller_fee<>0)
                or t.buyer_id is not distinct from t.seller_id""")
    chk(f"[{tag}] tiap trade: harga = harga maker, dalam batas limit kedua pihak, biaya benar, bukan self-trade",not v,str(v[:5]))
    f=q(e,"select count(*) from orders where status='filled' and remaining<>0")[0][0]
    chk(f"[{tag}] sisa order sesuai: Σ trades per order = qty - remaining",q(e,"""select count(*) from orders o where qty-remaining <>
        coalesce((select sum(qty) from trades t where t.buy_order_id=o.id or t.sell_order_id=o.id),0)""")[0][0]==0)


def rnd_op(e,rng,assets):
    i=rng.randrange(3); a=rng.choice(assets)
    ref=price(e,a); tk=TICK(ref)
    k=rng.random()
    if k<0.12:
        o=q(e,"select id from orders where team_id=%s and status in ('open','partial') order by random() limit 1",(e.teams[i],))
        if o: return cancel(e,i,o[0][0])
        return (True,None)
    side=rng.choice(('buy','sell'))
    if k<0.35: return po(e,i,a,side,'market',None,rng.randint(1,12))
    p=ref+rng.randint(-4,4)*tk; p=max((p//tk)*tk,tk)
    return po(e,i,a,side,'limit',p,rng.randint(1,6))

