import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('document uploads check the object path, retain owner isolation and require membership',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333'
 try{
 await db.exec(`create role authenticated; create schema auth; create schema storage; create schema rental_private;
 create function auth.uid() returns uuid language sql stable as $$select current_setting('request.uid')::uuid$$;
 create function rental_private.has_access() returns boolean language sql stable as $$select current_setting('request.access')='yes'$$;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create table public.properties(id uuid,owner_id uuid,name text);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage,auth,rental_private to authenticated;grant select on public.properties to authenticated;grant insert on storage.objects to authenticated;
 create policy financial_files_owner_insert on storage.objects for insert to authenticated with check(false);
 insert into public.properties values('${p}','${a}','46 Millcreek');`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261025051500_fix_property_document_storage_path_scope.sql',import.meta.url),'utf8'))
 await db.exec(`set role authenticated;select set_config('request.uid','${a}',false);select set_config('request.access','yes',false)`)
 const insert=(name,bucket='property-financial-documents')=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,name])
 await insert(`${a}/${p}/document/lease.pdf`)
 await assert.rejects(()=>insert(`${b}/${p}/document/lease.pdf`),/row-level security/)
 await assert.rejects(()=>insert(`${a}/${b}/document/lease.pdf`),/row-level security/)
 await assert.rejects(()=>insert(`${a}/${p}/document/lease.pdf`,'another-bucket'),/row-level security/)
 await db.exec(`select set_config('request.uid','${b}',false)`)
 await assert.rejects(()=>insert(`${b}/${p}/document/lease.pdf`),/row-level security/)
 await db.exec(`select set_config('request.uid','${a}',false);select set_config('request.access','no',false)`)
 await assert.rejects(()=>insert(`${a}/${p}/document/lease.pdf`),/row-level security/)
 }finally{await db.close()}
})
