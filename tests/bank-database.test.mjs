import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('bank reconciliation is owner-bound, idempotent and atomic across invoices and the ledger',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333'
 try{
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema rental_private;grant usage on schema auth,rental_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function rental_private.has_access() returns boolean language sql stable as $$select coalesce(current_setting('request.membership',true),'yes')='yes'$$;
 create table auth.users(id uuid primary key);create table properties(id uuid primary key,owner_id uuid,name text,address text,suburb text,status text);create table leases(id uuid primary key,owner_id uuid,property_id uuid);
 grant select on properties,leases to authenticated;insert into auth.users values('${a}'),('${b}');insert into properties values('${p}','${a}','Cottage','Sample road','Town','occupied');`)
 await db.exec((await readFile(new URL('../supabase/property-finances.sql',import.meta.url),'utf8')).split('insert into storage.buckets')[0]);await db.exec(await readFile(new URL('../supabase/rental-invoices.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/bank-reconciliation.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/tenant-screening.sql',import.meta.url),'utf8'))
 const invoice=(await db.query(`select public.rental_create_invoice($1,$2,'2020-01-01','2020-01-01','2020-01-01','{"landlord_name":"Example"}','{"name":"Tenant"}','[{"kind":"rent","label":"Rent","amount":800},{"kind":"service","label":"Water","amount":200}]') id`,[a,p])).rows[0].id
 const auth=async user=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`),reset=()=>db.exec('reset role')
 await auth(a)
 const insert=async(amount,fp)=>{const r=await db.query(`insert into bank_statement_transactions(owner_id,account_label,fingerprint,transaction_date,description,amount) values($1,'rental',$2,'2020-01-05','Example bank transaction',$3) on conflict(owner_id,account_label,fingerprint) do nothing returning id`,[a,fp.repeat(64),amount]);return r.rows[0]?.id}
 const tx=await insert(1000,'a');assert.equal(await insert(1000,'a'),undefined)
 await assert.rejects(()=>db.query(`insert into bank_statement_transactions(owner_id,account_label,fingerprint,transaction_date,description,amount,status) values($1,'x',$2,'2020-01-05','Invalid',1,'matched')`,[a,'b'.repeat(64)]))
 await assert.rejects(()=>db.query('update bank_statement_transactions set amount=2 where id=$1',[tx]))
 const reconcile=(id,action,target=null,rent=null,category=null)=>db.query('select public.reconcile_bank_transaction($1,$2,$3,$4,$5) id',[id,action,target,rent,category])
 await assert.rejects(()=>reconcile(tx,'payment',invoice,1000));assert.equal((await db.query('select count(*)::int n from rental_invoice_payments')).rows[0].n,0)
 const paid=(await reconcile(tx,'payment',invoice,800)).rows[0].id;assert.equal((await reconcile(tx,'payment',invoice,800)).rows[0].id,paid)
 assert.equal((await db.query('select count(*)::int n from rental_invoice_payments')).rows[0].n,1);assert.equal(Number((await db.query('select sum(amount) amount from property_financial_entries')).rows[0].amount),1000)
 const copy=await insert(1000,'b');await assert.rejects(()=>reconcile(copy,'link_payment',paid))
 await reconcile(tx,'undo');assert.equal((await db.query('select count(*)::int n from rental_invoice_payments')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from property_financial_entries')).rows[0].n,0)
 await reconcile(tx,'payment',invoice,800);assert.equal((await db.query('select count(*)::int n from rental_invoice_payments')).rows[0].n,1)
 const debit=await insert(-150,'c');await reconcile(debit,'expense',p,null,'repairs');assert.equal((await db.query("select count(*)::int n from property_financial_entries where entry_type='expense'")).rows[0].n,1)
 await reconcile(debit,'undo');await reconcile(debit,'ignore');await reconcile(debit,'undo');assert.equal((await db.query('select status from bank_statement_transactions where id=$1',[debit])).rows[0].status,'pending')
 await db.query("insert into tenant_screening_cases(owner_id,property_id,applicant_name) values($1,$2,'Example Applicant')",[a,p])
 await assert.rejects(()=>db.query("update tenant_screening_cases set stage='checks_requested' where owner_id=$1",[a]))
 await assert.rejects(()=>db.query("update tenant_screening_cases set report_path='other-owner/private.pdf' where owner_id=$1",[a]))
 await db.query("update tenant_screening_cases set consent_date='2020-01-01',consent_reference='Signed application',stage='checks_requested' where owner_id=$1",[a])
 await assert.rejects(()=>db.query("update tenant_screening_cases set owner_id=$1",[b]))
 await auth(b);assert.equal((await db.query('select count(*)::int n from tenant_screening_cases')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from bank_statement_transactions')).rows[0].n,0);await assert.rejects(()=>reconcile(tx,'undo'))
 await auth(a);await db.exec("select set_config('request.membership','no',false)");await assert.rejects(()=>reconcile(tx,'undo'));assert.equal((await db.query('select count(*)::int n from bank_statement_transactions')).rows[0].n,0)
 await reset();assert((await db.query('select count(*)::int n from bank_reconciliation_events')).rows[0].n>=7)
 }finally{await db.close()}
})
