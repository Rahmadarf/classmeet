import re
base="/mnt/user-data/outputs/classmeet-docs/"
def blocks(f): return re.findall(r"```sql\n(.*?)```", open(base+f,encoding="utf-8").read(), re.S)
stub="""
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
create publication supabase_realtime;
"""
bl=[b for f in ("03-database.md","04-rpc-contracts.md") for b in blocks(f) if "[lewati-uji]" not in b]
open("full2.sql","w").write(stub+"\n".join(bl))
print(len(bl),"blocks")
