-- Owner-only correction of rent-only receipts created through Quick Rent.
-- Invoice and cash-flow ledger are updated in the same transaction.
create function rental_private.correct_quick_rent(p_payment uuid,p_date date,p_amount numeric) returns void language plpgsql security definer set search_path='' as $$
declare payer uuid:=auth.uid();payment public.rental_invoice_payments;invoice public.rental_invoices;entry public.property_financial_entries;invoice_id uuid;due numeric;other_paid numeric;matches integer;
begin
 if payer is null or not rental_private.has_access() then raise exception 'Sign in with an active account';end if;
 if p_date is null or p_date>(now() at time zone 'Africa/Johannesburg')::date or p_amount is null or not(p_amount between 0.01 and 1000000000) or round(p_amount,2)<>p_amount then raise exception 'Check received date and amount';end if;
 select p.invoice_id into invoice_id from public.rental_invoice_payments p where p.id=p_payment and p.owner_id=payer;
 if not found then raise exception 'Payment not found';end if;
 select * into invoice from public.rental_invoices i where i.id=invoice_id and i.owner_id=payer for update;
 if not found then raise exception 'Invoice not found';end if;
 select * into payment from public.rental_invoice_payments p where p.id=p_payment and p.owner_id=payer for update;
 if payment.amount<>payment.rent_component or payment.reference<>'Quick rent '||payment.request_key::text then raise exception 'Only rent-only Quick Rent receipts can be edited here';end if;
 select coalesce(sum(l.amount),0) into due from public.rental_invoice_lines l where l.invoice_id=invoice.id and l.kind='rent';
 select coalesce(sum(p.rent_component),0) into other_paid from public.rental_invoice_payments p where p.invoice_id=invoice.id and p.id<>payment.id;
 if p_amount>due-other_paid then raise exception 'Amount exceeds rent due after other receipts';end if;
 select count(*) into matches from public.property_financial_entries e where e.owner_id=payer and e.property_id=invoice.property_id and e.category='rent' and e.entry_type='income' and e.reference=payment.reference;
 if matches<>1 then raise exception 'Ledger link needs review before editing';end if;
 select * into entry from public.property_financial_entries e where e.owner_id=payer and e.property_id=invoice.property_id and e.category='rent' and e.entry_type='income' and e.reference=payment.reference for update;
 if entry.amount<>payment.rent_component or entry.transaction_date<>payment.payment_date then raise exception 'Invoice and ledger differ; review before editing';end if;
 update public.rental_invoice_payments set payment_date=p_date,amount=p_amount,rent_component=p_amount where id=payment.id;
 update public.property_financial_entries set transaction_date=p_date,amount=p_amount,updated_at=now(),notes=coalesce(notes,'')||E'\nQuick Rent correction '||now()::text||': '||entry.transaction_date::text||' R'||entry.amount::text||' -> '||p_date::text||' R'||p_amount::text where id=entry.id;
end$$;
revoke all on function rental_private.correct_quick_rent(uuid,date,numeric) from public,anon,authenticated;
grant usage on schema rental_private to authenticated;
grant execute on function rental_private.correct_quick_rent(uuid,date,numeric) to authenticated;
create function public.correct_quick_rent(p_payment uuid,p_date date,p_amount numeric) returns void language sql security invoker set search_path='' as $$select rental_private.correct_quick_rent(p_payment,p_date,p_amount)$$;
revoke all on function public.correct_quick_rent(uuid,date,numeric) from public,anon;
grant execute on function public.correct_quick_rent(uuid,date,numeric) to authenticated;
