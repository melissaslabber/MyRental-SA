create table public.property_file_documents(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),
 section text not null check(section in('leases','accounts','maintenance','inspections','invoices')),document_type text not null check(length(document_type) between 1 and 60),title text not null check(length(title) between 1 and 200),
 linked_record_id uuid,storage_path text not null unique,file_name text not null,mime_type text not null,
 document_date date,term_from date,term_to date,monthly_rent numeric(12,2) check(monthly_rent>=0),
 landlord_signed boolean not null default false,tenant_signed boolean not null default false,signed_on date,notes text not null default '',created_at timestamptz not null default now(),
 check(term_to is null or term_from is null or term_to>=term_from),check(not(landlord_signed or tenant_signed) or signed_on is not null)
);
create index property_file_documents_owner_property on public.property_file_documents(owner_id,property_id,section);
alter table public.property_file_documents enable row level security;
revoke all on public.property_file_documents from public,anon,authenticated;
grant select,insert,update on public.property_file_documents to authenticated;
grant all on public.property_file_documents to service_role;
create policy property_file_owner on public.property_file_documents for all to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid())) and starts_with(storage_path,owner_id::text||'/'||property_id::text||'/'||id::text||'/'));
create policy property_file_membership on public.property_file_documents as restrictive for all to authenticated using((select rental_private.has_access())) with check((select rental_private.has_access()));
create table public.lease_terms_history(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),lease_id uuid references public.leases(id) on delete set null,
 tenant_name text,start_date date,end_date date,monthly_rent numeric(12,2),deposit_amount numeric(12,2),snapshot jsonb not null,recorded_at timestamptz not null default now()
);
create index lease_terms_history_owner_property on public.lease_terms_history(owner_id,property_id,recorded_at);
alter table public.lease_terms_history enable row level security;
revoke all on public.lease_terms_history from public,anon,authenticated;
grant select on public.lease_terms_history to authenticated;
grant all on public.lease_terms_history to service_role;
create policy lease_terms_owner on public.lease_terms_history for select to authenticated using(owner_id=(select auth.uid()) and (select rental_private.has_access()) and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid())));
insert into public.lease_terms_history(owner_id,property_id,lease_id,tenant_name,start_date,end_date,monthly_rent,deposit_amount,snapshot)
 select l.owner_id,l.property_id,l.id,l.tenant_name,l.start_date,l.end_date,l.monthly_rent,l.deposit_amount,to_jsonb(l) from public.leases l;
create function rental_private.capture_lease_terms() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then
  if row(old.tenant_name,old.start_date,old.end_date,old.monthly_rent,old.deposit_amount) is not distinct from row(new.tenant_name,new.start_date,new.end_date,new.monthly_rent,new.deposit_amount) then return new;end if;
 end if;
 insert into public.lease_terms_history(owner_id,property_id,lease_id,tenant_name,start_date,end_date,monthly_rent,deposit_amount,snapshot) values(new.owner_id,new.property_id,new.id,new.tenant_name,new.start_date,new.end_date,new.monthly_rent,new.deposit_amount,to_jsonb(new));return new;
end$$;
revoke all on function rental_private.capture_lease_terms() from public,anon,authenticated;
create trigger lease_terms_capture after insert or update on public.leases for each row execute function rental_private.capture_lease_terms();
