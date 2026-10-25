import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('deposit records enforce ownership, membership, lease/property consistency and retained evidence',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333',q='44444444-4444-4444-8444-444444444444',l='55555555-5555-4555-8555-555555555555'
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema rental_private;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function rental_private.has_access() returns boolean language sql stable as $$ select coalesce(current_setting('request.membership',true),'yes')='yes' $$;
 create table auth.users(id uuid primary key);create table public.properties(id uuid primary key,owner_id uuid);create table public.leases(id uuid primary key,owner_id uuid,property_id uuid);
 grant usage on schema auth,rental_private to authenticated;grant select on properties,leases to authenticated;
 insert into auth.users values('${a}'),('${b}');insert into properties values('${p}','${a}'),('${q}','${a}');insert into leases values('${l}','${a}','${p}');`)
 await db.exec(await readFile(new URL('../supabase/deposit-reconciliations.sql',import.meta.url),'utf8'))
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`)
 await db.query(`insert into deposit_reconciliations(owner_id,property_id,lease_id,status,form) values($1,$2,$3,'draft','{"status":"draft","held":"1000"}')`,[a,p,l])
 assert.equal((await db.query('select count(*)::int n from deposit_reconciliations')).rows[0].n,1)
 await assert.rejects(()=>db.query('update deposit_reconciliations set property_id=$1',[q]))
 await assert.rejects(()=>db.query('update deposit_reconciliations set owner_id=$1',[b]))
 await assert.rejects(()=>db.exec('delete from deposit_reconciliations'))
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`)
 assert.equal((await db.query('select count(*)::int n from deposit_reconciliations')).rows[0].n,0)
 await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);select set_config('request.membership','no',false)`)
 assert.equal((await db.query('select count(*)::int n from deposit_reconciliations')).rows[0].n,0)
 await db.exec('reset role');await assert.rejects(()=>db.query('delete from public.leases where id=$1',[l]));await db.close()
})
