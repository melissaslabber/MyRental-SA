create table public.tenant_screening_cases(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),
 applicant_name text not null check(length(applicant_name) between 1 and 150),provider text not null default 'MRI TPN' check(length(provider)<=100),
 stage text not null default 'awaiting_consent' check(stage in('awaiting_consent','checks_requested','report_received','reviewed')),
 consent_date date,consent_reference text not null default '',provider_reference text not null default '',
 report_path text,report_name text,checks jsonb not null default '{}' check(jsonb_typeof(checks)='object'),notes text not null default '' check(length(notes)<=5000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(stage='awaiting_consent' or (consent_date is not null and length(trim(consent_reference))>0)),
 check(stage not in('report_received','reviewed') or (report_path is not null or length(trim(provider_reference))>0))
);
create index screening_owner_property on public.tenant_screening_cases(owner_id,property_id,updated_at);
alter table public.tenant_screening_cases enable row level security;
revoke all on public.tenant_screening_cases from public,anon,authenticated;
grant select,insert,update on public.tenant_screening_cases to authenticated;
grant all on public.tenant_screening_cases to service_role;
create policy screening_owner on public.tenant_screening_cases for all to authenticated using(owner_id=(select auth.uid()) and (select rental_private.has_access())) with check(owner_id=(select auth.uid()) and (select rental_private.has_access()) and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid())) and (report_path is null or starts_with(report_path,owner_id::text||'/'||property_id::text||'/'||id::text||'/')));
