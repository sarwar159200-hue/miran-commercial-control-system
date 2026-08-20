-- MCCS V2.2.0 - history/edit support and invoice currency repair
-- Run after 007_near_go_live_core.sql
begin;

-- Repair invoice schema expected by the application.
alter table public.invoices add column if not exists currency_id uuid references public.currencies(id) on delete restrict;
alter table public.invoices add column if not exists is_historical boolean not null default false;
alter table public.invoices add column if not exists historical_source text;
alter table public.invoices add column if not exists historical_imported_at timestamptz;
alter table public.invoices add column if not exists historical_imported_by uuid references public.profiles(id);
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_by uuid references public.profiles(id);

alter table public.payments add column if not exists is_historical boolean not null default false;
alter table public.payments add column if not exists historical_source text;
alter table public.payments add column if not exists historical_imported_at timestamptz;
alter table public.payments add column if not exists historical_imported_by uuid references public.profiles(id);
alter table public.payments add column if not exists updated_at timestamptz not null default now();
alter table public.payments add column if not exists updated_by uuid references public.profiles(id);

alter table public.purchase_orders add column if not exists updated_at timestamptz not null default now();
alter table public.purchase_orders add column if not exists updated_by uuid references public.profiles(id);
alter table public.payment_milestones add column if not exists updated_at timestamptz not null default now();
alter table public.payment_milestones add column if not exists updated_by uuid references public.profiles(id);
alter table public.vendors add column if not exists updated_at timestamptz not null default now();
alter table public.vendors add column if not exists updated_by uuid references public.profiles(id);
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists updated_by uuid references public.profiles(id);

create index if not exists idx_invoices_currency on public.invoices(currency_id);

grant select,insert,update,delete on public.invoices to authenticated;
grant select,insert,update,delete on public.payments to authenticated;
grant select,insert,update,delete on public.documents to authenticated;
grant all on public.invoices to service_role;
grant all on public.payments to service_role;
grant all on public.documents to service_role;

-- Safe Super Admin write policy for documents metadata.
drop policy if exists "documents_manage_super_admin" on public.documents;
create policy "documents_manage_super_admin" on public.documents
for all to authenticated
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

commit;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='invoices'
  and column_name in ('currency_id','is_historical','historical_source','updated_at','updated_by')
order by column_name;
