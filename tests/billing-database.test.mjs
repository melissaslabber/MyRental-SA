import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const owner='11111111-1111-4111-8111-111111111111',alice='22222222-2222-4222-8222-222222222222',bob='33333333-3333-4333-8333-333333333333'
test('database lifecycle, duplicate delivery, cancellation and member isolation',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;grant usage on schema auth to authenticated,service_role;
 create table auth.users(id uuid primary key,email text,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;
 create table public.profiles(id uuid primary key,created_at timestamptz default now());
 create table public.properties(id uuid primary key default gen_random_uuid(),owner_id uuid not null,name text,address text default 'Example Street',suburb text default 'Sample Town');
 create table public.leases(id uuid primary key,owner_id uuid,property_id uuid);
 create table public.inspection_reports(id uuid primary key,owner_id uuid,property_id uuid);
 create function public.handle_new_user() returns trigger language plpgsql security definer as $$begin return new;end$$;
 alter table public.properties enable row level security;alter table public.leases enable row level security;alter table public.inspection_reports enable row level security;
 create policy owner on public.properties to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
 grant select,insert,update,delete on public.properties to authenticated;
 insert into auth.users(id,email) values('${owner}','owner@example.test'),('${alice}','alice@example.test'),('${bob}','bob@example.test');
 insert into public.profiles(id) select id from auth.users;
 insert into public.properties(owner_id,name) values('${alice}','Alice home'),('${bob}','Bob home');`)
 const schema=(await readFile(new URL('../supabase/membership.sql',import.meta.url),'utf8')).split('-- Install the job only once')[0]
 await db.exec(schema)
 const finance=(await readFile(new URL('../supabase/property-finances.sql',import.meta.url),'utf8')).split('insert into storage.buckets')[0]
 await db.exec(finance)
 await db.exec(await readFile(new URL('../supabase/rental-invoices.sql',import.meta.url),'utf8'))
 await db.exec(`insert into public.billing_admins(user_id) values('${owner}');update public.billing_settings set enabled=true;`)
 const begin=async(user,ref)=>{const r=await db.query('select * from public.billing_begin_checkout($1,89,$2,$3)',[user,ref,'terms-v1']);return r.rows[0]}
 const sub=await begin(alice,'MRSA-alice')
 await assert.rejects(()=>begin(alice,'MRSA-duplicate'))
 const now=new Date(),through=new Date(now.getTime()+86400000*30)
 const event=async(id,status='COMPLETE',reference='MRSA-alice',amount=89,token='provider-token',at=now)=>db.query('select public.billing_apply_event($1,$2,$3,$4,null,null,$5,$6,$7)',[reference,id,status,amount,at.toISOString(),through.toISOString(),token])
 await assert.rejects(()=>event('bad','COMPLETE','MRSA-alice',1))
 await event('payment-1');await event('payment-1')
 assert.equal((await db.query('select count(*)::integer n from billing_transactions')).rows[0].n,1)
 await event('payment-1','FAILED')
 assert.equal((await db.query('select status from billing_subscriptions')).rows[0].status,'active')
 const see=async(user)=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);const r=await db.query('select name from public.properties order by name');await db.exec('reset role');return r.rows.map(r=>r.name)}
 assert.deepEqual(await see(alice),['Alice home']);assert.deepEqual(await see(bob),[])
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false)`)
 await assert.rejects(()=>db.query('update public.billing_members set free_access=true'))
 await assert.rejects(()=>db.query(`insert into billing_admins(user_id) values('${bob}')`))
 await assert.rejects(()=>db.query('select * from billing_secrets'))
 await db.exec('reset role')
 await db.query('select public.billing_cancel_local($1,$2,$3)',[sub.id,alice,'Testing cancellation'])
 // A new, valid COMPLETE after cancellation must never reopen access.
 await event('payment-after-cancel','COMPLETE','MRSA-alice',89,'provider-token',new Date(now.getTime()+60000))
 assert.equal((await db.query('select status from billing_subscriptions')).rows[0].status,'cancelled')
 assert.deepEqual(await see(alice),[])
 assert.equal((await db.query('select count(*)::integer n from billing_refunds')).rows[0].n,1)
 await db.query('select public.billing_cancel_local($1,$2,$3)',[sub.id,alice,'Repeated request'])
 assert.equal((await db.query('select count(*)::integer n from billing_refunds')).rows[0].n,1)
 await db.exec(`update billing_members set free_access=true where user_id='${bob}'`)
 assert.deepEqual(await see(bob),['Bob home'])
 await db.exec(`update billing_members set suspended=true where user_id='${bob}'`)
 assert.deepEqual(await see(bob),[])
 // An invoice payment is posted to annual income exactly once, with rent/services split.
 const prop=(await db.query('select id from properties where owner_id=$1',[alice])).rows[0].id
 const made=await db.query('select public.rental_create_invoice($1,$2,$3,$4,$5,$6,$7,$8) id',[alice,prop,'2026-10-01','2026-09-28','2026-10-01',JSON.stringify({landlord_name:'Example'}),JSON.stringify({name:'Tenant'}),JSON.stringify([{kind:'rent',label:'Rent',amount:10000},{kind:'service',label:'Water',amount:600}])])
 const inv=made.rows[0].id,request='44444444-4444-4444-8444-444444444444'
 const pay=()=>db.query('select public.rental_record_payment($1,$2,$3,$4,$5,$6,$7)',[alice,inv,'2026-10-01',10600,10000,'bank-ref',request])
 await pay();await pay()
 assert.equal((await db.query('select count(*)::integer n from rental_invoice_payments')).rows[0].n,1)
 assert.equal((await db.query('select sum(amount)::numeric amount from property_financial_entries')).rows[0].amount,'10600.00')
 await assert.rejects(()=>db.query('select public.rental_record_payment($1,$2,$3,$4,$5,$6,$7)',[bob,inv,'2026-10-01',1,1,'wrong-owner','55555555-5555-4555-8555-555555555555']))
 await db.exec(`update billing_settings set enabled=false`)
 assert.deepEqual(await see(alice),['Alice home'])
 assert.deepEqual(await see(bob),[]) // suspension still blocks free access
 }finally{await db.close()}
})
