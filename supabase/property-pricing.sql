create function rental_private.property_price(p_count bigint) returns numeric language sql immutable set search_path='' as $$select case when p_count>=20 then 1500 when p_count>=10 then 599 when p_count>=3 then 299 else 89 end::numeric$$;
revoke all on function rental_private.property_price(bigint) from public,anon,authenticated;
grant execute on function rental_private.property_price(bigint) to service_role;
create table public.billing_plan_changes(id uuid primary key default gen_random_uuid(),subscription_id uuid not null unique references public.billing_subscriptions(id),user_id uuid not null references auth.users(id),old_amount numeric not null,new_amount numeric not null check(new_amount in(89,299,599,1500)),status text not null default 'prepared' check(status in('prepared','applied')),created_at timestamptz not null default now(),applied_at timestamptz);
alter table public.billing_plan_changes enable row level security;
revoke all on public.billing_plan_changes from public,anon,authenticated;
grant all on public.billing_plan_changes to service_role;
create function public.billing_prepare_plan(p_user uuid,p_amount numeric) returns public.billing_plan_changes language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions;c public.billing_plan_changes;homes bigint;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into s from public.billing_subscriptions where user_id=p_user and status='active' and cancel_requested_at is null order by created_at desc limit 1 for update;
 if not found or s.provider_token is null then raise exception 'An active confirmed subscription is required';end if;
 select count(*) into homes from public.properties where owner_id=p_user;
 if p_amount not in(89,299,599,1500) or p_amount<rental_private.property_price(homes) then raise exception 'The plan must cover all saved properties';end if;
 select * into c from public.billing_plan_changes where subscription_id=s.id for update;
 if found and c.status='prepared' then if c.new_amount<>p_amount then raise exception 'Finish the pending plan change before choosing another';end if;return c;end if;
 insert into public.billing_plan_changes(subscription_id,user_id,old_amount,new_amount) values(s.id,p_user,s.amount,p_amount) on conflict(subscription_id) do update set old_amount=s.amount,new_amount=p_amount,status='prepared',created_at=now(),applied_at=null returning * into c;
 return c;end$$;
create function public.billing_finish_plan(p_id uuid,p_user uuid) returns void language plpgsql security invoker set search_path='' as $$declare c public.billing_plan_changes;begin
 select * into c from public.billing_plan_changes where id=p_id and user_id=p_user;if not found then raise exception 'Plan change not found';end if;
 perform 1 from public.billing_subscriptions where id=c.subscription_id for update;
 select * into c from public.billing_plan_changes where id=p_id and user_id=p_user for update;
 update public.billing_subscriptions set amount=c.new_amount where id=c.subscription_id and user_id=p_user and status='active' and cancel_requested_at is null;
 if not found then raise exception 'Subscription changed; review provider billing before retrying';end if;
 update public.billing_plan_changes set status='applied',applied_at=now() where id=c.id;
 insert into public.billing_audit(action,subject_id,details) values('plan_change_confirmed',p_user,jsonb_build_object('oldAmount',c.old_amount,'newAmount',c.new_amount));end$$;
revoke all on function public.billing_prepare_plan(uuid,numeric),public.billing_finish_plan(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_prepare_plan(uuid,numeric),public.billing_finish_plan(uuid,uuid) to service_role;
create function rental_private.enforce_property_plan() returns trigger language plpgsql security definer set search_path='' as $$declare homes bigint;amount numeric;begin
 if auth.uid() is null then return new;end if;
 if new.owner_id<>auth.uid() then raise exception 'Only add homes to your own account';end if;
 if exists(select 1 from public.billing_settings where not enabled) or exists(select 1 from public.billing_admins where user_id=new.owner_id) or exists(select 1 from public.billing_members where user_id=new.owner_id and free_access and not suspended) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 select count(*)+1 into homes from public.properties where owner_id=new.owner_id and id<>new.id;
 select s.amount into amount from public.billing_subscriptions s where s.user_id=new.owner_id and s.status='active' and s.cancel_requested_at is null and s.paid_through>now() order by s.created_at desc limit 1;
 if amount is null or amount<rental_private.property_price(homes) then raise exception 'Your property limit has been reached. Review the plan for % homes in Settings > My membership (R% per month).',homes,rental_private.property_price(homes);end if;
 return new;end$$;
revoke all on function rental_private.enforce_property_plan() from public,anon,authenticated;
create trigger property_subscription_capacity before insert or update of owner_id on public.properties for each row execute function rental_private.enforce_property_plan();

create or replace function public.billing_apply_event(p_reference text,p_provider text,p_status text,p_amount numeric,p_fee numeric,p_net numeric,p_paid_at timestamptz,p_paid_through timestamptz,p_token text) returns jsonb language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions; affected integer;begin
 select * into s from public.billing_subscriptions where payment_reference=p_reference for update;
 if not found then raise exception 'Unknown payment reference';end if;
 if p_token is not null and s.provider_token is not null and p_token<>s.provider_token then raise exception 'Subscription token mismatch';end if;
 if exists(select 1 from public.billing_transactions t where t.subscription_id=s.id and t.provider_payment_id=p_provider and t.status=p_status and t.amount=p_amount) then if p_token is not null then update public.billing_subscriptions set provider_token=coalesce(provider_token,p_token) where id=s.id;end if;return jsonb_build_object('duplicate',true);end if;
 if p_amount<>s.amount then
  if exists(select 1 from public.billing_plan_changes c where c.subscription_id=s.id and c.new_amount=p_amount and c.status='prepared' and p_paid_at>=c.created_at) then
   update public.billing_subscriptions set amount=p_amount where id=s.id;
   update public.billing_plan_changes set status='applied',applied_at=now() where subscription_id=s.id;
  elsif not exists(select 1 from public.billing_plan_changes c where c.subscription_id=s.id and c.old_amount=p_amount and p_paid_at<c.created_at) then raise exception 'Incorrect payment amount';end if;
 end if;
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

create or replace function public.billing_cancel_local(p_id uuid,p_user uuid,p_reason text) returns void language plpgsql security invoker set search_path='' as $$declare s public.billing_subscriptions;begin
 select * into s from public.billing_subscriptions where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Unknown subscription';end if;
 update public.billing_subscriptions set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancel_requested_at=coalesce(cancel_requested_at,now()),cancellation_reason=p_reason where id=s.id;
 if s.first_paid_at is not null and not exists(select 1 from public.billing_subscriptions old where old.user_id=p_user and old.id<>s.id and old.first_paid_at<s.first_paid_at) and coalesce(s.cancel_requested_at,now())<=s.first_paid_at+interval '48 hours' then
 insert into public.billing_refunds(subscription_id,user_id,amount) select s.id,p_user,t.amount from public.billing_transactions t where t.subscription_id=s.id and t.status='COMPLETE' order by t.paid_at,t.id limit 1 on conflict do nothing;end if;
 insert into public.billing_audit(actor_id,action,subject_id,details) values(p_user,'subscription_cancelled',p_user,jsonb_build_object('subscription',s.id));end$$;
