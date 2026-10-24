-- MyRental SA only. Subscription data is never client writable.
create schema if not exists rental_private;
revoke all on schema rental_private from public,anon;
grant usage on schema rental_private to authenticated,service_role;
create table public.billing_settings(id boolean primary key default true check(id),enabled boolean not null default false,sandbox boolean not null default true,amount numeric(12,2) not null default 89 check(amount>=5),updated_at timestamptz not null default now());
insert into public.billing_settings(id) values(true);
create table public.billing_admins(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
-- Bootstrap the verified owner via a separate server-side insert after approval.
create table public.billing_secrets(name text primary key,ciphertext text not null,updated_at timestamptz not null default now());
create table public.billing_members(user_id uuid primary key references auth.users(id),free_access boolean not null default false,suspended boolean not null default false,last_seen_at timestamptz,created_at timestamptz not null default now());
insert into public.billing_members(user_id,created_at) select id,created_at from auth.users;
create table public.billing_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),payment_reference text not null unique,status text not null default 'pending' check(status in('pending','active','failed','cancellation_pending','cancelled')),amount numeric(12,2) not null check(amount>=5),provider_token text unique,first_paid_at timestamptz,last_paid_at timestamptz,paid_through timestamptz,cancel_requested_at timestamptz,cancelled_at timestamptz,cancellation_reason text,terms_version text not null,accepted_at timestamptz not null default now(),created_at timestamptz not null default now());
create unique index billing_one_current on public.billing_subscriptions(user_id) where status<>'cancelled';
create index billing_subscriptions_user on public.billing_subscriptions(user_id,created_at desc);
create table public.billing_transactions(id bigint generated always as identity primary key,subscription_id uuid not null references public.billing_subscriptions(id),provider_payment_id text not null,status text not null check(status in('COMPLETE','FAILED','CANCELLED')),amount numeric(12,2) not null,fee numeric(12,2),net numeric(12,2),paid_at timestamptz not null,received_at timestamptz not null default now(),unique(provider_payment_id,status));
create table public.billing_refunds(id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.billing_subscriptions(id),user_id uuid not null references auth.users(id),amount numeric(12,2) not null,status text not null default 'review_required' check(status in('review_required','processed','declined')),provider_reference text,notes text,created_at timestamptz not null default now(),processed_at timestamptz,unique(subscription_id));
create table public.billing_audit(id bigint generated always as identity primary key,actor_id uuid,action text not null,subject_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.billing_email_queue(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),kind text not null,period text not null,scheduled_at timestamptz not null,status text not null default 'queued' check(status in('queued','sending','sent','failed','skipped')),attempts integer not null default 0,last_error text,sent_at timestamptz,unique(user_id,kind,period));
-- Enable RLS and deny direct writes, including admin self-promotion.
do $$declare t text;begin foreach t in array array['billing_settings','billing_admins','billing_secrets','billing_members','billing_subscriptions','billing_transactions','billing_refunds','billing_audit','billing_email_queue'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
grant usage,select on all sequences in schema public to service_role;
create function public.billing_begin_checkout(p_user uuid,p_amount numeric,p_reference text,p_terms text) returns public.billing_subscriptions language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.billing_subscriptions where user_id=p_user and status<>'cancelled') then raise exception 'An existing payment or subscription needs review before another checkout';end if;
 insert into public.billing_subscriptions(user_id,amount,payment_reference,terms_version) values(p_user,p_amount,p_reference,p_terms) returning * into s;return s;end$$;
create function public.billing_apply_event(p_reference text,p_provider text,p_status text,p_amount numeric,p_fee numeric,p_net numeric,p_paid_at timestamptz,p_paid_through timestamptz,p_token text) returns jsonb language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions; affected integer;begin
 select * into s from public.billing_subscriptions where payment_reference=p_reference for update;
 if not found then raise exception 'Unknown payment reference';end if;
 if p_amount<>s.amount then raise exception 'Incorrect payment amount';end if;
 if p_token is not null and s.provider_token is not null and p_token<>s.provider_token then raise exception 'Subscription token mismatch';end if;
 insert into public.billing_transactions(subscription_id,provider_payment_id,status,amount,fee,net,paid_at) values(s.id,p_provider,p_status,p_amount,p_fee,p_net,p_paid_at) on conflict do nothing;get diagnostics affected=row_count;
 if affected=0 then if p_token is not null then update public.billing_subscriptions set provider_token=coalesce(provider_token,p_token) where id=s.id;end if;return jsonb_build_object('duplicate',true);end if;
 if p_status='COMPLETE' and (s.last_paid_at is null or p_paid_at>s.last_paid_at) then
 update public.billing_subscriptions set status=case when cancel_requested_at is not null then status else 'active' end,provider_token=coalesce(provider_token,p_token),first_paid_at=coalesce(first_paid_at,p_paid_at),last_paid_at=p_paid_at,paid_through=p_paid_through where id=s.id;
 elsif p_status in('FAILED','CANCELLED') and s.cancel_requested_at is null and not exists(select 1 from public.billing_transactions where provider_payment_id=p_provider and status='COMPLETE') and (s.last_paid_at is null or p_paid_at>s.last_paid_at) then
 update public.billing_subscriptions set status=case when p_status='FAILED' then 'failed' else 'cancellation_pending' end,cancel_requested_at=case when p_status='CANCELLED' then now() else null end where id=s.id;
 end if;
 insert into public.billing_audit(action,subject_id,details) values('payfast_verified',s.user_id,jsonb_build_object('subscription',s.id,'status',p_status,'transaction',p_provider));
 return jsonb_build_object('duplicate',false);end$$;
create function public.billing_cancel_local(p_id uuid,p_user uuid,p_reason text) returns void language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions;begin
 select * into s from public.billing_subscriptions where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Unknown subscription';end if;
 update public.billing_subscriptions set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancel_requested_at=coalesce(cancel_requested_at,now()),cancellation_reason=p_reason where id=s.id;
 if s.first_paid_at is not null and not exists(select 1 from public.billing_subscriptions old where old.user_id=p_user and old.id<>s.id and old.first_paid_at<s.first_paid_at) and coalesce(s.cancel_requested_at,now())<=s.first_paid_at+interval '48 hours' then
 insert into public.billing_refunds(subscription_id,user_id,amount) values(s.id,p_user,s.amount) on conflict do nothing;end if;
 insert into public.billing_audit(actor_id,action,subject_id,details) values(p_user,'subscription_cancelled',p_user,jsonb_build_object('subscription',s.id));end$$;
revoke all on function public.billing_begin_checkout(uuid,numeric,text,text) from public,anon,authenticated;
revoke all on function public.billing_apply_event(text,text,text,numeric,numeric,numeric,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.billing_cancel_local(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.billing_begin_checkout(uuid,numeric,text,text),public.billing_apply_event(text,text,text,numeric,numeric,numeric,timestamptz,timestamptz,text),public.billing_cancel_local(uuid,uuid,text) to service_role;
-- Paid access is enforced by Postgres, not just a hidden UI.
create function rental_private.has_access() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and (exists(select 1 from public.billing_admins where user_id=auth.uid()) or (not exists(select 1 from public.billing_members where user_id=auth.uid() and suspended) and (not exists(select 1 from public.billing_settings where enabled) or exists(select 1 from public.billing_members where user_id=auth.uid() and free_access) or exists(select 1 from public.billing_subscriptions where user_id=auth.uid() and status='active' and cancel_requested_at is null and paid_through>now()))));$$;
revoke all on function rental_private.has_access() from public,anon;
grant execute on function rental_private.has_access() to authenticated;
-- Complete the durable rental backend used by the existing UI.
create table if not exists public.rental_records(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid references public.properties(id),record_type text not null check(record_type in('application','inspection','document','finance','renewal')),title text not null,status text not null,due_date date,amount numeric(12,2),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.maintenance_items(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),issue text not null,reported_by text not null default 'Landlord',urgent boolean not null default false,responsibility text not null default 'To assess',status text not null default 'Logged',contractor text,quote_amount numeric(12,2),actual_cost numeric(12,2),last_followed_up date,feedback text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index rental_records_owner on public.rental_records(owner_id,record_type);
create index maintenance_items_owner on public.maintenance_items(owner_id,status);
do $$declare t text;begin foreach t in array array['rental_records','maintenance_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy owner_records on public.%I for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()))',t);
 end loop;
 foreach t in array array['properties','leases','inspection_reports','rental_records','maintenance_items'] loop execute format('create policy paid_membership on public.%I as restrictive for all to authenticated using((select rental_private.has_access())) with check((select rental_private.has_access()))',t);end loop;end$$;
-- Existing trigger still populates profiles; prevent direct invocation through the API.
revoke execute on function public.handle_new_user() from public,anon,authenticated;
create function public.billing_summary() returns jsonb language sql security invoker set search_path='' as $$select jsonb_build_object('signups',(select count(*) from public.profiles),'active',(select count(*) from public.billing_subscriptions s where s.status='active' and s.cancel_requested_at is null and s.paid_through>now() and not exists(select 1 from public.billing_members m where m.user_id=s.user_id and m.suspended)),'pending',(select count(*) from public.billing_subscriptions where status='pending'),'failed',(select count(*) from public.billing_subscriptions where status='failed'),'cancelled',(select count(*) from public.billing_subscriptions where status in('cancelled','cancellation_pending')),'free',(select count(*) from public.billing_members where free_access and not suspended),'seen7days',(select count(*) from public.billing_members where last_seen_at>now()-interval '7 days'),'gross',(select coalesce(sum(amount),0) from public.billing_transactions where status='COMPLETE'),'refundsDue',(select count(*) from public.billing_refunds where status='review_required'),'refunded',(select coalesce(sum(amount),0) from public.billing_refunds where status='processed'),'mrr',(select coalesce(sum(amount),0) from public.billing_subscriptions where status='active' and cancel_requested_at is null and paid_through>now()));$$;
revoke all on function public.billing_summary() from public,anon,authenticated;
grant execute on function public.billing_summary() to service_role;
-- Transactional reminder queue: one 10-minute reminder, one 24-hour reminder,
-- then one monthly reminder while signup/payment remains outstanding.
create table public.billing_job_keys(id boolean primary key default true check(id),token text not null default encode(gen_random_bytes(32),'hex'));
alter table public.billing_job_keys enable row level security;
revoke all on public.billing_job_keys from public,anon,authenticated;
grant all on public.billing_job_keys to service_role;
insert into public.billing_job_keys(id) values(true);
alter table public.billing_email_queue add column locked_at timestamptz;
create function public.billing_plan_reminders() returns void language sql security invoker set search_path='' as $$
 insert into public.billing_email_queue(user_id,kind,period,scheduled_at)
 select p.id,plan.kind,plan.period,plan.due from public.profiles p
 cross join lateral (values('payment_10m','once',p.created_at+interval '10 minutes'),('payment_24h','once',p.created_at+interval '24 hours'),('payment_monthly',greatest(1,floor(extract(epoch from now()-p.created_at)/2592000))::text,p.created_at+interval '30 days'*greatest(1,floor(extract(epoch from now()-p.created_at)/2592000)))) plan(kind,period,due)
 where exists(select 1 from public.billing_settings where enabled)
 and plan.due<=now() and p.created_at>='2026-10-24T00:00:00Z'
 and not exists(select 1 from public.billing_admins where user_id=p.id)
 and not exists(select 1 from public.billing_members where user_id=p.id and (free_access or suspended))
 and coalesce((select s.status from public.billing_subscriptions s where s.user_id=p.id order by s.created_at desc limit 1),'pending') in('pending','failed')
 on conflict do nothing;
$$;
create function public.billing_claim_emails() returns setof public.billing_email_queue language sql security invoker set search_path='' as $$
 update public.billing_email_queue set status='sending',locked_at=now(),attempts=attempts+1 where id in(
 select id from public.billing_email_queue where scheduled_at<=now() and scheduled_at>now()-interval '23 hours' and attempts<3 and (status in('queued','failed') or status='sending' and locked_at<now()-interval '10 minutes') order by scheduled_at limit 20 for update skip locked) returning *;
$$;
revoke all on function public.billing_plan_reminders(),public.billing_claim_emails() from public,anon,authenticated;
grant execute on function public.billing_plan_reminders(),public.billing_claim_emails() to service_role;
-- Install the job only once the schema is approved. A configured email key AND
-- enabled subscriptions are required before the scheduler sends a request.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('myrental-membership-reminders','* * * * *',$job$
 select net.http_post(url:='https://hneloyinjdhgocezglxl.supabase.co/functions/v1/membership/reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k.token),body:='{}'::jsonb) from public.billing_job_keys k where exists(select 1 from public.billing_settings where enabled) and exists(select 1 from public.billing_secrets where name='RESEND_API_KEY');
$job$);
create table public.billing_deletion_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id),status text not null default 'pending_review',created_at timestamptz not null default now(),notes text);
alter table public.billing_deletion_requests enable row level security;
revoke all on public.billing_deletion_requests from public,anon,authenticated;
grant all on public.billing_deletion_requests to service_role;
