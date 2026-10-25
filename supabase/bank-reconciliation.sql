create table public.bank_statement_transactions(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 account_label text not null check(length(account_label) between 1 and 80),fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 transaction_date date not null check(transaction_date<=(now() at time zone 'Africa/Johannesburg')::date),description text not null check(length(description) between 1 and 500),
 amount numeric(14,2) not null check(amount<>0 and abs(amount)<=1000000000),balance numeric(16,2),external_id text,
 status text not null default 'pending' check(status in('pending','matched','ignored')),
 payment_id uuid unique references public.rental_invoice_payments(id),entry_id uuid unique references public.property_financial_entries(id),
 created_record boolean not null default false,matched_at timestamptz,created_at timestamptz not null default now(),
 unique(owner_id,account_label,fingerprint)
);
create index bank_transactions_owner_status on public.bank_statement_transactions(owner_id,status,transaction_date);
alter table public.bank_statement_transactions enable row level security;
revoke all on public.bank_statement_transactions from public,anon,authenticated;
grant select on public.bank_statement_transactions to authenticated;
grant insert(id,owner_id,account_label,fingerprint,transaction_date,description,amount,balance,external_id) on public.bank_statement_transactions to authenticated;
grant all on public.bank_statement_transactions to service_role;
create policy bank_owner on public.bank_statement_transactions for all to authenticated using(owner_id=(select auth.uid()) and (select rental_private.has_access())) with check(owner_id=(select auth.uid()) and (select rental_private.has_access()));
create table public.bank_reconciliation_events(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),transaction_id uuid not null references public.bank_statement_transactions(id),action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.bank_reconciliation_events enable row level security;
revoke all on public.bank_reconciliation_events from public,anon,authenticated;
grant select on public.bank_reconciliation_events to authenticated;grant all on public.bank_reconciliation_events to service_role;
create policy bank_event_owner on public.bank_reconciliation_events for select to authenticated using(owner_id=(select auth.uid()) and (select rental_private.has_access()));
-- A narrowly scoped private function atomically writes the receipt and mirrored ledger.
-- It never accepts an owner ID; identity and active membership are checked on every call.
create function rental_private.bank_reconcile(p_transaction uuid,p_action text,p_target uuid default null,p_rent numeric default null,p_category text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();tx public.bank_statement_transactions;payment public.rental_invoice_payments;entry public.property_financial_entries;target_id uuid;ref text;ledger_total numeric;begin
 if caller is null or not rental_private.has_access() then raise exception 'Sign in with an active account';end if;
 select * into tx from public.bank_statement_transactions where id=p_transaction and owner_id=caller for update;
 if not found then raise exception 'Bank transaction not found';end if;
 ref:='Bank statement '||tx.id::text;
 if p_action='undo' then
  if tx.status='pending' then return tx.id;end if;
  if tx.created_record and tx.payment_id is not null then
   select * into payment from public.rental_invoice_payments where id=tx.payment_id and owner_id=caller;
   perform 1 from public.rental_invoices where id=payment.invoice_id and owner_id=caller for update;
   select * into payment from public.rental_invoice_payments where id=tx.payment_id and owner_id=caller for update;
   if not found or payment.reference<>ref or payment.amount<>tx.amount or payment.payment_date<>tx.transaction_date then raise exception 'Receipt has changed. Review it before undoing the match';end if;
   select coalesce(sum(amount),0) into ledger_total from public.property_financial_entries where owner_id=caller and reference=ref and entry_type='income';
   if exists(select 1 from public.property_financial_entries e where e.owner_id=caller and e.reference=ref and (e.updated_at<>e.created_at or e.created_at<>tx.matched_at or e.transaction_date<>tx.transaction_date or coalesce(jsonb_array_length(e.attachments),0)>0)) then raise exception 'Receipt evidence or financial entries were edited. Review them before undoing';end if;
   if ledger_total<>tx.amount then raise exception 'Financial entries have changed. Review them before undoing';end if;
   update public.bank_statement_transactions set payment_id=null where id=tx.id;
   delete from public.property_financial_entries where owner_id=caller and reference=ref and entry_type='income';
   delete from public.rental_invoice_payments where id=payment.id and owner_id=caller;
  elsif tx.created_record and tx.entry_id is not null then
   select * into entry from public.property_financial_entries where id=tx.entry_id and owner_id=caller for update;
   if not found or entry.reference<>ref or entry.amount<>abs(tx.amount) or entry.updated_at<>entry.created_at or entry.created_at<>tx.matched_at or coalesce(jsonb_array_length(entry.attachments),0)>0 or exists(select 1 from public.rental_invoice_lines where source_entry_id=entry.id) then raise exception 'The financial record was edited or used in an invoice. Review it before undoing';end if;
   update public.bank_statement_transactions set entry_id=null where id=tx.id;
   delete from public.property_financial_entries where id=entry.id and owner_id=caller;
  end if;
  update public.bank_statement_transactions set status='pending',payment_id=null,entry_id=null,created_record=false,matched_at=null where id=tx.id;
 elsif p_action='ignore' then
  if tx.status='matched' then raise exception 'Undo the match first';end if;
  update public.bank_statement_transactions set status='ignored',matched_at=now() where id=tx.id;
 else
  if tx.status='matched' then
   if p_action='payment' and exists(select 1 from public.rental_invoice_payments where id=tx.payment_id and invoice_id=p_target) then return tx.payment_id;end if;
   if p_action='link_payment' and tx.payment_id=p_target then return tx.payment_id;end if;
   if p_action='link_entry' and tx.entry_id=p_target then return tx.entry_id;end if;
   if p_action='expense' and exists(select 1 from public.property_financial_entries where id=tx.entry_id and property_id=p_target and category=p_category) then return tx.entry_id;end if;
   raise exception 'This bank transaction is already matched. Refresh or undo it first';
  end if;
  if tx.status<>'pending' then raise exception 'Reopen the transaction before matching';end if;
  if p_action='payment' then
   if tx.amount<=0 or p_rent is null or p_rent<0 or round(p_rent,2)<>p_rent then raise exception 'Check the receipt and rent allocation';end if;
   if exists(select 1 from public.rental_invoice_payments p where p.owner_id=caller and p.invoice_id=p_target and p.payment_date=tx.transaction_date and p.amount=tx.amount and not exists(select 1 from public.bank_statement_transactions b where b.payment_id=p.id)) then raise exception 'A receipt with this date and amount is already recorded. Link the existing receipt instead';end if;
   if exists(select 1 from public.property_financial_entries e join public.rental_invoices i on i.id=p_target and i.property_id=e.property_id where e.owner_id=caller and e.category='rent' and e.transaction_date=tx.transaction_date and e.amount=tx.amount and e.description not like '%'||i.invoice_number||'%' and not exists(select 1 from public.bank_statement_transactions b where b.entry_id=e.id)) then raise exception 'Rent is already recorded as a financial entry. Link that entry instead';end if;
   target_id:=public.rental_record_payment(caller,p_target,tx.transaction_date,tx.amount,p_rent,ref,tx.id);
   update public.bank_statement_transactions set status='matched',payment_id=target_id,created_record=true,matched_at=now() where id=tx.id;
  elsif p_action='link_payment' then
   select * into payment from public.rental_invoice_payments where id=p_target and owner_id=caller;
   if not found or tx.amount<=0 or payment.amount<>tx.amount or payment.payment_date<>tx.transaction_date then raise exception 'Choose an existing receipt with the same amount and received date';end if;
   update public.bank_statement_transactions set status='matched',payment_id=payment.id,created_record=false,matched_at=now() where id=tx.id;target_id:=payment.id;
  elsif p_action='link_entry' then
   select * into entry from public.property_financial_entries where id=p_target and owner_id=caller;
   if not found or entry.amount<>abs(tx.amount) or entry.transaction_date<>tx.transaction_date or (tx.amount<0 and entry.entry_type<>'expense') or (tx.amount>0 and entry.entry_type<>'income') then raise exception 'Choose an existing financial entry with the same date and amount';end if;
   if exists(select 1 from public.rental_invoices i where i.owner_id=caller and i.property_id=entry.property_id and entry.description like '%'||i.invoice_number||'%' and entry.entry_type='income') then raise exception 'This is an invoice-linked ledger entry. Link the original invoice receipt instead';end if;
   update public.bank_statement_transactions set status='matched',entry_id=entry.id,created_record=false,matched_at=now() where id=tx.id;target_id:=entry.id;
  elsif p_action='expense' then
   if tx.amount>=0 or p_category is null or p_category not in('municipal','rates','electricity','water','sewer_refuse','repairs','improvements','levies','insurance','bond_interest','bond_capital','agent_fees','professional_fees','other_expense') then raise exception 'Choose an expense category for a bank debit';end if;
   if not exists(select 1 from public.properties where id=p_target and owner_id=caller and status<>'archived') then raise exception 'Choose an active property you own';end if;
   if exists(select 1 from public.property_financial_entries e where e.owner_id=caller and e.property_id=p_target and e.entry_type='expense' and e.amount=abs(tx.amount) and e.transaction_date=tx.transaction_date and not exists(select 1 from public.bank_statement_transactions b where b.entry_id=e.id)) then raise exception 'An expense with the same date and amount exists. Link it first';end if;
   insert into public.property_financial_entries(owner_id,property_id,transaction_date,entry_type,category,description,amount,paid_by,tenant_responsibility,reference) values(caller,p_target,tx.transaction_date,'expense',p_category,tx.description,abs(tx.amount),'landlord',0,ref) returning id into target_id;
   update public.bank_statement_transactions set status='matched',entry_id=target_id,created_record=true,matched_at=now() where id=tx.id;
  else raise exception 'Unknown reconciliation action';end if;
 end if;
 insert into public.bank_reconciliation_events(owner_id,transaction_id,action,details) values(caller,tx.id,p_action,jsonb_build_object('previous_status',tx.status,'payment_id',tx.payment_id,'entry_id',tx.entry_id,'target',target_id,'amount',tx.amount,'payment_snapshot',to_jsonb(payment),'entry_snapshot',to_jsonb(entry)));
 return coalesce(target_id,tx.id);
end$$;
revoke all on function rental_private.bank_reconcile(uuid,text,uuid,numeric,text) from public,anon;
grant execute on function rental_private.bank_reconcile(uuid,text,uuid,numeric,text) to authenticated;
create function public.reconcile_bank_transaction(p_transaction uuid,p_action text,p_target uuid default null,p_rent numeric default null,p_category text default null) returns uuid language sql security invoker set search_path='' as $$select rental_private.bank_reconcile(p_transaction,p_action,p_target,p_rent,p_category)$$;
revoke all on function public.reconcile_bank_transaction(uuid,text,uuid,numeric,text) from public,anon;
grant execute on function public.reconcile_bank_transaction(uuid,text,uuid,numeric,text) to authenticated;
