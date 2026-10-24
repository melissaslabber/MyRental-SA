create table public.agent_contact_requests(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),request_key uuid not null unique,
 first_name text not null,surname text not null,email text not null,phone text not null,property_address text not null,notes text not null default '',
 recipient_email text not null,consent_version text not null,consented_at timestamptz not null default now(),
 email_status text not null default 'queued' check(email_status in('queued','sending','accepted','failed','needs_review')),
 contact_status text not null default 'New' check(contact_status in('New','Contacted','Closed')),
 attempts integer not null default 0,first_attempt_at timestamptz,locked_at timestamptz,next_attempt_at timestamptz not null default now(),provider_id text,last_error text,created_at timestamptz not null default now()
);
create index agent_requests_owner on public.agent_contact_requests(owner_id,created_at);
alter table public.agent_contact_requests enable row level security;
revoke all on public.agent_contact_requests from public,anon,authenticated;
grant select on public.agent_contact_requests to authenticated;
grant all on public.agent_contact_requests to service_role;
create policy agent_requests_owner_select on public.agent_contact_requests for select to authenticated using(owner_id=auth.uid() and (select rental_private.has_access()));
create function public.claim_agent_contacts(p_id uuid default null) returns setof public.agent_contact_requests language sql security invoker set search_path='' as $$
 update public.agent_contact_requests set email_status='sending',attempts=attempts+1,locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) where id in (
 select id from public.agent_contact_requests where (p_id is null or id=p_id) and attempts<4 and next_attempt_at<=now()
 and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours')
 and (email_status in('queued','failed') or email_status='sending' and locked_at<now()-interval '10 minutes') order by created_at limit 10 for update skip locked) returning *;
$$;
revoke all on function public.claim_agent_contacts(uuid) from public,anon,authenticated;
grant execute on function public.claim_agent_contacts(uuid) to service_role;
-- Contact requests can send independently of whether paid subscriptions are enabled.
select cron.schedule('myrental-membership-reminders','* * * * *',$job$
 select net.http_post(url:='https://hneloyinjdhgocezglxl.supabase.co/functions/v1/membership/reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k.token),body:='{}'::jsonb) from public.billing_job_keys k where exists(select 1 from public.billing_secrets where name='RESEND_API_KEY') and (exists(select 1 from public.billing_settings where enabled) or exists(select 1 from public.agent_contact_requests where email_status in('queued','failed','sending') and attempts<4 and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours')));
$job$);
