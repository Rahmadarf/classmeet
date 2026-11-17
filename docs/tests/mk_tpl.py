import subprocess, sys
from t2 import *
c=admin_conn("postgres"); cu=c.cursor()
cu.execute("drop database if exists ctest_tpl"); cu.execute("create database ctest_tpl"); c.close()
r=subprocess.run(["psql","-h",HOST,"-p",str(PORT),"-U","postgres","-d","ctest_tpl","-v","ON_ERROR_STOP=1","-q","-f","full2.sql"],capture_output=True,text=True)
if r.returncode!=0: print("FAIL: migrasi",r.stderr[-300:]); sys.exit(1)
