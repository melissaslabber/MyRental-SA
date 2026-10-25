-- Apply after membership.sql. All files remain private to their property owner.
create table public.property_financial_entries(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),
 transaction_date date not null,entry_type text not null check(entry_type in('income','expense')),
 category text not null,description text not null check(length(description)>0),amount numeric(12,2) not null check(amount>0),
 paid_by text not null check(paid_by in('landlord','tenant')),tenant_responsibility numeric(12,2) not null default 0 check(tenant_responsibility>=0 and tenant_responsibility<=amount),
 reference text,bill_date date,notes text,attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index property_financial_owner_date on public.property_financial_entries(owner_id,transaction_date);
create index property_financial_property_date on public.property_financial_entries(property_id,transaction_date);
alter table public.property_financial_entries enable row level security;
grant select,insert,update,delete on public.property_financial_entries to authenticated;
grant all on public.property_financial_entries to service_role;
create policy financial_owner on public.property_financial_entries for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
create policy financial_membership on public.property_financial_entries as restrictive for all to authenticated using((select rental_private.has_access())) with check((select rental_private.has_access()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('property-financial-documents','property-financial-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy financial_files_owner_select on storage.objects for select to authenticated using(bucket_id='property-financial-documents' and (storage.foldername(name))[1]=auth.uid()::text and (select rental_private.has_access()));
create policy financial_files_owner_insert on storage.objects for insert to authenticated with check(bucket_id='property-financial-documents' and (storage.foldername(name))[1]=auth.uid()::text and (select rental_private.has_access()) and exists(select 1 from public.properties p where p.id::text=(storage.foldername(objects.name))[2] and p.owner_id=auth.uid()));
create policy financial_files_owner_delete on storage.objects for delete to authenticated using(bucket_id='property-financial-documents' and (storage.foldername(name))[1]=auth.uid()::text and (select rental_private.has_access()));
