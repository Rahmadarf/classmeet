"""Uji mutasi: python3 mut.py <nomor> [berkas_mutasi.json]
build2.py menghasilkan full2.sql -> salin ke full2.base.sql. Skrip ini mengganti SATU potongan SQL,
membangun ulang template (mk_tpl.py), menjalankan skrip uji yang dipilih, lalu memulihkan full2.sql.
Hasil: 'TERTANGKAP' hanya bila ada baris FAIL. Skrip yang CRASH (Traceback) dilaporkan terpisah dan TIDAK dihitung
sebagai tertangkap maupun lolos: jalankan sendiri dan baca stderr (pelajaran: crash pernah terbaca '0 gagal')."""
import sys,subprocess,os,json
f=sys.argv[2] if len(sys.argv)>2 else "mutations.json"
name,a,b,runs=json.load(open(f))[int(sys.argv[1])]
src=open("full2.base.sql").read()
assert src.count(a)>=1,("pola tidak ditemukan",name)
open("full2.sql","w").write(src.replace(a,b,1))
env=dict(os.environ,PGHOST="/tmp",PGPORT="54329")
try:
    p=subprocess.run(["python3","mk_tpl.py"],env=env,capture_output=True,text=True,timeout=300)
    if p.returncode!=0: print(name,"-> MIGRASI GAGAL (mutasi merusak sintaks):",p.stdout[-200:]); raise SystemExit
    out=[];crash=[]
    for r in runs:
        p=subprocess.run(["python3",r],env=env,capture_output=True,text=True,timeout=1500)
        out+=[l for l in p.stdout.splitlines() if l.startswith("FAIL")]
        if "Traceback" in p.stderr or p.returncode!=0: crash.append((r,p.stderr.strip().splitlines()[-1][:160] if p.stderr.strip() else "kode keluar %d"%p.returncode))
    verdict="TERTANGKAP" if out else ("CRASH-TANPA-FAIL" if crash else "LOLOS")
    print(f"{name} -> {verdict}: {len(out)} gagal"+(f", {len(crash)} skrip crash" if crash else ""))
    for x in out[:3]: print("   ",x[:170])
    for r,m in crash[:2]: print("    CRASH",r,m)
finally:
    open("full2.sql","w").write(src)
