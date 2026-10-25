-- Owner-only deposit statements. These records never initiate payments.
create table public.deposit_reconciliations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 property_id uuid not null references public.properties(id),
 lease_id uuid not null unique references public.leases(id),
 status text not null default 'draft' check(status in ('draft','reviewed','refunded')),
 form jsonb not null check(jsonb_typeof(form)='object' and form ? 'status' and form->>'status'=status),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index deposit_reconciliations_owner_property on public.deposit_reconciliations(owner_id,property_id);
alter table public.deposit_reconciliations enable row level security;
revoke all on public.deposit_reconciliations from public,anon,authenticated;
grant select,insert,update on public.deposit_reconciliations to authenticated;
grant all on public.deposit_reconciliations to service_role;
create policy deposit_statement_owner on public.deposit_reconciliations for all to authenticated
 using(owner_id=(select auth.uid()) and (select rental_private.has_access()))
 with check(owner_id=(select auth.uid()) and (select rental_private.has_access()) and exists(
  select 1 from public.leases l join public.properties p on p.id=l.property_id
  where l.id=lease_id and l.property_id=deposit_reconciliations.property_id and l.owner_id=(select auth.uid()) and p.owner_id=(select auth.uid())
 ));
