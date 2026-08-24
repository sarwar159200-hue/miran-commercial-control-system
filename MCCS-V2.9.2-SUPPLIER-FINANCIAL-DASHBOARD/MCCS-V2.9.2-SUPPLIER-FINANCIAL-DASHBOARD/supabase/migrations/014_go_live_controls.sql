-- MCCS 014_go_live_controls.sql
-- Go-live controls: PO printable template fields, PO items, audit-safe delete fields.

begin;

alter table public.purchase_orders
  add column if not exists quote_ref text,
  add column if not exists quote_date date,
  add column if not exists incoterm text,
  add column if not exists origin_of_goods text,
  add column if not exists warranty text,
  add column if not exists shipping_address text,
  add column if not exists billing_address text,
  add column if not exists other_instruction text,
  add column if not exists discount numeric(20,4) not null default 0,
  add column if not exists extra_cost numeric(20,4) not null default 0,
  add column if not exists prepared_by text,
  add column if not exists initial_po_date date,
  add column if not exists revised_po_date date,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

alter table public.projects
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

alter table public.vendors
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  sequence_no integer not null default 1,
  item_code text,
  description text not null,
  site text,
  uom text,
  quantity numeric(20,4) not null default 1,
  unit_cost numeric(20,4) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz,
  updated_by uuid references public.profiles(id)
);
create index if not exists idx_po_items_po on public.purchase_order_items(purchase_order_id, sequence_no);

alter table public.purchase_order_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_order_items' and policyname='authenticated_read_po_items') then
    create policy authenticated_read_po_items on public.purchase_order_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_order_items' and policyname='authenticated_write_po_items') then
    create policy authenticated_write_po_items on public.purchase_order_items for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true));
  end if;
end $$;

grant select, insert, update, delete on public.purchase_order_items to authenticated;
grant all on public.purchase_order_items to service_role;

commit;
