create table public.document_shop_orders (
 id uuid primary key, slug text not null references public.document_shop_packages(slug),
 package_sha256 text not null, amount_cents integer not null check(amount_cents>0),
 email text not null, buyer_name text not null, access_hash text not null,
 ip_hash text not null, terms_version text not null, status text not null default 'pending' check(status in ('pending','paid','refunded')),
 provider_payment_id text unique, created_at timestamptz not null default now(), paid_at timestamptz,
 access_expires_at timestamptz not null default (now()+interval '30 days')
);
alter table public.document_shop_orders enable row level security;
revoke all on public.document_shop_orders from public,anon,authenticated;
grant select,insert,update,delete on public.document_shop_orders to service_role;
create index document_shop_orders_ip_created on public.document_shop_orders(ip_hash,created_at);
create function public.document_shop_credentials() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}'::jsonb) from vault.decrypted_secrets where name in ('myrental_document_merchant_id','myrental_document_merchant_key','myrental_document_passphrase');
$$;
revoke all on function public.document_shop_credentials() from public,anon,authenticated;
grant execute on function public.document_shop_credentials() to service_role;
