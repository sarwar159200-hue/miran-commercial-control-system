-- ============================================================
-- MCCS - Miran Commercial Control System
-- Migration: 007_near_go_live_core.sql
-- Run AFTER migrations 001 - 006
-- ============================================================

begin;

-- 1. PROJECTS
alter table if exists public.projects add column if not exists description text;
alter table if exists public.projects add column if not exists start_date date;
alter table if exists public.projects add column if not exists planned_finish_date date;

-- 2. ADD ADMIN ROLE
-- Existing MCCS schema requires role_code and role_name.
do $$
begin
    if to_regclass('public.roles') is null then
        raise notice 'public.roles does not exist - skipping Admin role seed.';
        return;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'roles'
          and column_name = 'role_code'
    )
    and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'roles'
          and column_name = 'role_name'
    ) then
        insert into public.roles (role_code, role_name)
        select 'admin', 'Admin'
        where not exists (
            select 1
            from public.roles
            where lower(role_code) = 'admin'
               or lower(role_name) = 'admin'
        );
    else
        raise exception
            'Expected public.roles columns role_code and role_name were not found. 007 stopped to avoid an invalid role seed.';
    end if;
end $$;

-- 3. PAYMENT MILESTONES
alter table if exists public.payment_milestones add column if not exists percentage numeric(7,4);
alter table if exists public.payment_milestones add column if not exists fixed_amount numeric(18,2);
alter table if exists public.payment_milestones add column if not exists payment_due_date date;
alter table if exists public.payment_milestones add column if not exists notes text;

-- 4. INVOICES
create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    purchase_order_id uuid references public.purchase_orders(id) on delete restrict,
    payment_milestone_id uuid references public.payment_milestones(id) on delete set null,
    vendor_id uuid references public.vendors(id) on delete restrict,
    invoice_number text not null,
    invoice_date date not null,
    received_date date,
    invoice_amount numeric(18,2) not null default 0,
    certified_amount numeric(18,2) not null default 0,
    due_date date,
    status text not null default 'Received',
    verification_notes text,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists invoices_invoice_number_uidx
on public.invoices (invoice_number);

-- 5. PAYMENTS
create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    purchase_order_id uuid references public.purchase_orders(id) on delete restrict,
    invoice_id uuid references public.invoices(id) on delete set null,
    currency_id uuid references public.currencies(id) on delete restrict,
    payment_date date not null,
    paid_amount numeric(18,2) not null default 0,
    payment_reference text,
    bank_reference text,
    notes text,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 6. VALIDATION CONSTRAINTS
do $$
begin
    if to_regclass('public.payment_milestones') is not null
       and not exists (select 1 from pg_constraint where conname='payment_milestones_percentage_check') then
        alter table public.payment_milestones
            add constraint payment_milestones_percentage_check
            check (percentage is null or (percentage >= 0 and percentage <= 100));
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname='invoices_amount_check') then
        alter table public.invoices
            add constraint invoices_amount_check check (invoice_amount >= 0);
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname='invoices_certified_amount_check') then
        alter table public.invoices
            add constraint invoices_certified_amount_check check (certified_amount >= 0);
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname='payments_paid_amount_check') then
        alter table public.payments
            add constraint payments_paid_amount_check check (paid_amount >= 0);
    end if;
end $$;

-- 7. INDEXES
create index if not exists idx_invoices_purchase_order on public.invoices(purchase_order_id);
create index if not exists idx_invoices_vendor on public.invoices(vendor_id);
create index if not exists idx_invoices_milestone on public.invoices(payment_milestone_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_payments_purchase_order on public.payments(purchase_order_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_payment_date on public.payments(payment_date);

-- 8. RLS
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

-- 9. API GRANTS
grant select, insert, update, delete on public.projects to authenticated;
grant select on public.roles to authenticated;
grant select, insert, update, delete on public.payment_milestones to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

grant all on public.projects to service_role;
grant all on public.roles to service_role;
grant all on public.payment_milestones to service_role;
grant all on public.invoices to service_role;
grant all on public.payments to service_role;

-- 10. INVOICE POLICIES
drop policy if exists "mccs_authenticated_read_invoices" on public.invoices;
create policy "mccs_authenticated_read_invoices"
on public.invoices for select to authenticated using (true);

drop policy if exists "mccs_authenticated_insert_invoices" on public.invoices;
create policy "mccs_authenticated_insert_invoices"
on public.invoices for insert to authenticated with check (true);

drop policy if exists "mccs_authenticated_update_invoices" on public.invoices;
create policy "mccs_authenticated_update_invoices"
on public.invoices for update to authenticated using (true) with check (true);

drop policy if exists "mccs_authenticated_delete_invoices" on public.invoices;
create policy "mccs_authenticated_delete_invoices"
on public.invoices for delete to authenticated using (true);

-- 11. PAYMENT POLICIES
drop policy if exists "mccs_authenticated_read_payments" on public.payments;
create policy "mccs_authenticated_read_payments"
on public.payments for select to authenticated using (true);

drop policy if exists "mccs_authenticated_insert_payments" on public.payments;
create policy "mccs_authenticated_insert_payments"
on public.payments for insert to authenticated with check (true);

drop policy if exists "mccs_authenticated_update_payments" on public.payments;
create policy "mccs_authenticated_update_payments"
on public.payments for update to authenticated using (true) with check (true);

drop policy if exists "mccs_authenticated_delete_payments" on public.payments;
create policy "mccs_authenticated_delete_payments"
on public.payments for delete to authenticated using (true);

-- 12. DROP OLD SUMMARY VIEW
-- Required because PostgreSQL cannot implicitly rename an existing view column.
drop view if exists public.po_milestone_summary;

-- 13. RECREATE PO MILESTONE SUMMARY
create view public.po_milestone_summary as
select
    po.id as purchase_order_id,
    po.po_number,
    coalesce(po.current_value, 0)::numeric(18,2) as po_current_value,

    coalesce(
        sum(case
            when pm.status is distinct from 'cancelled'
            then coalesce(pm.percentage, 0)
            else 0
        end), 0
    )::numeric(12,4) as allocated_percentage,

    coalesce(
        sum(case
            when pm.status is distinct from 'cancelled' then
                case
                    when pm.percentage is not null
                    then coalesce(po.current_value,0) * pm.percentage / 100.0
                    else coalesce(pm.fixed_amount,0)
                end
            else 0
        end), 0
    )::numeric(18,2) as allocated_amount,

    greatest(
        100.0 - coalesce(
            sum(case
                when pm.status is distinct from 'cancelled'
                then coalesce(pm.percentage,0)
                else 0
            end), 0
        ), 0
    )::numeric(12,4) as remaining_percentage,

    greatest(
        coalesce(po.current_value,0) -
        coalesce(
            sum(case
                when pm.status is distinct from 'cancelled' then
                    case
                        when pm.percentage is not null
                        then coalesce(po.current_value,0) * pm.percentage / 100.0
                        else coalesce(pm.fixed_amount,0)
                    end
                else 0
            end), 0
        ), 0
    )::numeric(18,2) as remaining_amount,

    count(pm.id) filter (
        where pm.status is distinct from 'cancelled'
    ) as milestone_count

from public.purchase_orders po
left join public.payment_milestones pm
    on pm.purchase_order_id = po.id
group by po.id, po.po_number, po.current_value;

grant select on public.po_milestone_summary to authenticated, service_role;

-- 14. BACKFILL OLD MILESTONE PERCENTAGES
update public.payment_milestones pm
set percentage = round(
    (pm.fixed_amount / nullif(po.current_value,0)) * 100.0,
    4
)
from public.purchase_orders po
where pm.purchase_order_id = po.id
  and pm.percentage is null
  and pm.fixed_amount is not null
  and po.current_value > 0;

-- 15. SYNCHRONIZE MILESTONE AMOUNTS
update public.payment_milestones pm
set fixed_amount = round(
    (po.current_value * pm.percentage) / 100.0,
    2
)
from public.purchase_orders po
where pm.purchase_order_id = po.id
  and pm.percentage is not null
  and po.current_value is not null
  and po.current_value > 0;

commit;

-- Validation
select
    purchase_order_id,
    po_number,
    po_current_value,
    allocated_percentage,
    allocated_amount,
    remaining_percentage,
    remaining_amount,
    milestone_count
from public.po_milestone_summary
order by po_number;

-- ============================================================
-- 007 MIGRATION COMPLETE
-- ============================================================
