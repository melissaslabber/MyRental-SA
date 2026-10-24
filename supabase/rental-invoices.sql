-- Depends on membership.sql and property-finances.sql.
create table public.rental_invoice_settings(property_id uuid primary key references public.properties(id),owner_id uuid not null references auth.users(id),landlord_name text not null,landlord_email text,landlord_phone text,landlord_address text,bank_name text,account_holder text,account_number text,branch_code text,payment_reference text,due_day integer not null default 1 check(due_day between 1 and 31),send_day integer not null default 1 check(send_day between 1 and 31),alert_day integer not null default 5 check(alert_day between 1 and 31),auto_email boolean not null default false,recurring_extras jsonb not null default '[]',updated_at timestamptz not null default now());
create table public.rental_invoices(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),property_id uuid not null references public.properties(id),invoice_number text not null unique,rental_month date not null,issue_date date not null,due_date date not null,landlord_details jsonb not null,tenant_details jsonb not null,property_name text not null,property_address text not null,status text not null default 'draft' check(status in('draft','issued')),kind text not null default 'monthly' check(kind in('monthly','supplement')),created_at timestamptz not null default now());
create unique index rental_one_monthly_invoice on public.rental_invoices(property_id,rental_month) where kind='monthly';
create table public.rental_invoice_lines(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.rental_invoices(id),owner_id uuid not null references auth.users(id),label text not null,kind text not null check(kind in('rent','service')),amount numeric(12,2) not null check(amount>0),source_entry_id uuid unique references public.property_financial_entries(id));
create table public.rental_invoice_payments(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.rental_invoices(id),owner_id uuid not null references auth.users(id),payment_date date not null,amount numeric(12,2) not null check(amount>0),rent_component numeric(12,2) not null check(rent_component>=0 and rent_component<=amount),reference text,request_key uuid not null unique,created_at timestamptz not null default now());
create table public.rental_breach_records(invoice_id uuid primary key references public.rental_invoices(id),owner_id uuid not null references auth.users(id),notice_date date,remedy_deadline date,lease_clause text,delivery_method text,delivered_at timestamptz,delivery_proof text,notes text,updated_at timestamptz not null default now());
create table public.rental_invoice_dispatches(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.rental_invoices(id),kind text not null check(kind in('invoice','friendly_reminder','owner_overdue')),status text not null default 'queued',attempts integer not null default 0,locked_at timestamptz,provider_id text,last_error text,created_at timestamptz not null default now(),sent_at timestamptz,unique(invoice_id,kind));
create index rental_invoices_owner_month on public.rental_invoices(owner_id,rental_month);
create index rental_invoice_lines_parent on public.rental_invoice_lines(invoice_id);
create index rental_invoice_payments_parent on public.rental_invoice_payments(invoice_id);
do $$declare t text;begin foreach t in array array['rental_invoice_settings','rental_invoices','rental_invoice_lines','rental_invoice_payments','rental_breach_records'] loop
 execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 execute format('create policy invoice_owner_select on public.%I for select to authenticated using(auth.uid()=owner_id)',t);
 execute format('create policy invoice_paid_access on public.%I as restrictive for all to authenticated using((select rental_private.has_access())) with check((select rental_private.has_access()))',t);
 end loop;end$$;
grant insert,update on public.rental_invoice_settings to authenticated;
create policy invoice_settings_write on public.rental_invoice_settings for insert to authenticated with check(auth.uid()=owner_id and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
create policy invoice_settings_update on public.rental_invoice_settings for update to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
grant insert,update on public.rental_breach_records to authenticated;
create policy breach_insert on public.rental_breach_records for insert to authenticated with check(auth.uid()=owner_id and exists(select 1 from public.rental_invoices i where i.id=invoice_id and i.owner_id=auth.uid()));
create policy breach_update on public.rental_breach_records for update to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id and exists(select 1 from public.rental_invoices i where i.id=invoice_id and i.owner_id=auth.uid()));
alter table public.rental_invoice_dispatches enable row level security;
revoke all on public.rental_invoice_dispatches from public,anon,authenticated;
grant all on public.rental_invoice_dispatches to service_role;
-- These functions use caller rights. RLS checks every record and ownership.
-- Only the server can create invoices/payments; member auth is validated there.
create function public.rental_create_invoice(p_owner uuid,p_property uuid,p_month date,p_issue date,p_due date,p_landlord jsonb,p_tenant jsonb,p_lines jsonb,p_kind text default 'monthly') returns uuid language plpgsql security invoker set search_path='' as $$declare item jsonb; invoice_id uuid;prop public.properties;source public.property_financial_entries;begin
 perform pg_advisory_xact_lock(hashtextextended(p_property::text||p_month::text,0));
 if p_month<>date_trunc('month',p_month)::date then raise exception 'Rental month must start on the first';end if;
 select * into prop from public.properties where id=p_property and owner_id=p_owner;if not found then raise exception 'Property not found';end if;
 if p_kind not in('monthly','supplement') then raise exception 'Invalid invoice type';end if;
 if p_kind='supplement' and exists(select 1 from jsonb_array_elements(p_lines) l where l->>'kind'='rent') then raise exception 'Supplementary invoices must not charge rent again';end if;
 if jsonb_array_length(p_lines)=0 then raise exception 'Add invoice charges';end if;
 insert into public.rental_invoices(owner_id,property_id,invoice_number,rental_month,issue_date,due_date,landlord_details,tenant_details,property_name,property_address,status,kind)
 values(p_owner,p_property,'MR-'||to_char(p_month,'YYYYMM')||'-'||upper(substr(gen_random_uuid()::text,1,8)),p_month,p_issue,p_due,p_landlord,p_tenant,prop.name,prop.address||', '||prop.suburb,'issued',p_kind) returning id into invoice_id;
 for item in select value from jsonb_array_elements(p_lines) loop
 if item->>'source_entry_id' is not null and item->>'source_entry_id'<>'' then
 select * into source from public.property_financial_entries where id=(item->>'source_entry_id')::uuid and owner_id=p_owner and property_id=p_property and entry_type='expense' and paid_by='landlord';
 if not found or source.tenant_responsibility<>(item->>'amount')::numeric then raise exception 'Municipal charge must match the tenant responsibility on the landlord-paid bill';end if;end if;
 insert into public.rental_invoice_lines(invoice_id,owner_id,label,kind,amount,source_entry_id) values(invoice_id,p_owner,item->>'label',item->>'kind',(item->>'amount')::numeric,nullif(item->>'source_entry_id','')::uuid);
 end loop;return invoice_id;end$$;
create function public.rental_record_payment(p_owner uuid,p_invoice uuid,p_date date,p_amount numeric,p_rent numeric,p_reference text,p_request uuid) returns uuid language plpgsql security invoker set search_path='' as $$declare i public.rental_invoices;total numeric;received numeric;rent_due numeric;rent_received numeric;payment_id uuid;begin
 select id into payment_id from public.rental_invoice_payments where request_key=p_request and owner_id=p_owner and invoice_id=p_invoice;if found then return payment_id;end if;
 select * into i from public.rental_invoices where id=p_invoice and owner_id=p_owner for update;if not found then raise exception 'Invoice not found';end if;
 select coalesce(sum(amount),0),coalesce(sum(amount)filter(where kind='rent'),0) into total,rent_due from public.rental_invoice_lines where invoice_id=i.id;
 select coalesce(sum(amount),0),coalesce(sum(rent_component),0) into received,rent_received from public.rental_invoice_payments where invoice_id=i.id;
 if p_amount<=0 or p_amount>total-received or p_rent<0 or p_rent>p_amount or p_rent>rent_due-rent_received or p_amount-p_rent>(total-rent_due)-(received-rent_received) then raise exception 'Payment allocation exceeds the outstanding rent or services';end if;
 insert into public.rental_invoice_payments(invoice_id,owner_id,payment_date,amount,rent_component,reference,request_key) values(i.id,p_owner,p_date,p_amount,p_rent,p_reference,p_request) returning id into payment_id;
 if p_rent>0 then insert into public.property_financial_entries(owner_id,property_id,transaction_date,entry_type,category,description,amount,paid_by,reference) values(p_owner,i.property_id,p_date,'income','rent','Rent received for '||to_char(i.rental_month,'FMMonth YYYY')||' / '||i.invoice_number,p_rent,'tenant',p_reference);end if;
 if p_amount>p_rent then insert into public.property_financial_entries(owner_id,property_id,transaction_date,entry_type,category,description,amount,paid_by,reference) values(p_owner,i.property_id,p_date,'income','tenant_recovery','Services received / '||i.invoice_number,p_amount-p_rent,'tenant',p_reference);end if;
 return payment_id;end$$;
revoke all on function public.rental_create_invoice(uuid,uuid,date,date,date,jsonb,jsonb,jsonb,text),public.rental_record_payment(uuid,uuid,date,numeric,numeric,text,uuid) from public,anon,authenticated;
grant execute on function public.rental_create_invoice(uuid,uuid,date,date,date,jsonb,jsonb,jsonb,text),public.rental_record_payment(uuid,uuid,date,numeric,numeric,text,uuid) to service_role;
