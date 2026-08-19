-- MCCS 007_near_go_live_core.sql
-- Run after 006_projects_and_po_detail_fix.sql
begin;

-- Project fields required by the MCCS UI.
alter table public.projects
  add column if not exists description text,
  add column if not exists start_date date,
  add column if not exists planned_finish_date date;

-- Additional application role requested for day-to-day administration.
insert into public.roles(role_code, role_name, description, is_active)
values ('admin','Admin','Operational administrator without Super Admin ownership controls',true)
on conflict (role_code) do update set role_name=excluded.role_name, description=excluded.description, is_active=true;

-- Invoice workflow.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id),
  milestone_id uuid references public.payment_milestones(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  received_date date,
  currency_id uuid not null references public.currencies(id),
  invoice_amount numeric(20,4) not null default 0 check(invoice_amount >= 0),
  certified_amount numeric(20,4) not null default 0 check(certified_amount >= 0),
  status text not null default 'received' check(status in ('received','under_verification','approved','rejected','submitted_to_ap','partially_paid','paid','on_hold')),
  verification_notes text,
  submitted_to_ap_date date,
  due_date date,
  is_historical boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique(vendor_id, invoice_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  currency_id uuid not null references public.currencies(id),
  payment_date date not null,
  paid_amount numeric(20,4) not null check(paid_amount >= 0),
  payment_reference text,
  bank_reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists invoices_po_idx on public.invoices(purchase_order_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists payments_po_idx on public.payments(purchase_order_id);

alter table public.invoices enable row level security;
alter table public.payments enable row level security;

grant select,insert,update,delete on public.invoices to authenticated;
grant select,insert,update,delete on public.payments to authenticated;
grant all privileges on public.invoices to service_role;
grant all privileges on public.payments to service_role;

drop policy if exists "invoices_read_authenticated" on public.invoices;
drop policy if exists "invoices_manage_super_admin" on public.invoices;
create policy "invoices_read_authenticated" on public.invoices for select to authenticated using(true);
create policy "invoices_manage_super_admin" on public.invoices for all to authenticated
using(public.current_user_is_super_admin()) with check(public.current_user_is_super_admin());

drop policy if exists "payments_read_authenticated" on public.payments;
drop policy if exists "payments_manage_super_admin" on public.payments;
create policy "payments_read_authenticated" on public.payments for select to authenticated using(true);
create policy "payments_manage_super_admin" on public.payments for all to authenticated
using(public.current_user_is_super_admin()) with check(public.current_user_is_super_admin());

-- Auditing.
drop trigger if exists invoices_audit_mccs on public.invoices;
create trigger invoices_audit_mccs after insert or update or delete on public.invoices
for each row execute function public.audit_row_change();

drop trigger if exists payments_audit_mccs on public.payments;
create trigger payments_audit_mccs after insert or update or delete on public.payments
for each row execute function public.audit_row_change();

-- Milestone commercial roll-up. Percentage drives calculated amount when supplied.
create or replace view public.po_milestone_summary as
select
  po.id as purchase_order_id,
  po.po_number,
  po.current_value,
  coalesce(sum(pm.percentage),0) as allocated_percentage,
  coalesce(sum(
    case
      when pm.percentage is not null then po.current_value * pm.percentage / 100.0
      else coalesce(pm.fixed_amount,0)
    end
  ),0) as allocated_amount,
  greatest(100 - coalesce(sum(pm.percentage),0),0) as remaining_percentage,
  greatest(po.current_value - coalesce(sum(
    case
      when pm.percentage is not null then po.current_value * pm.percentage / 100.0
      else coalesce(pm.fixed_amount,0)
    end
  ),0),0) as remaining_amount,
  count(pm.id) as milestone_count
from public.purchase_orders po
left join public.payment_milestones pm on pm.purchase_order_id=po.id and pm.status <> 'cancelled'
group by po.id,po.po_number,po.current_value;

grant select on public.po_milestone_summary to authenticated, service_role;

-- Backfill percentage for older milestones that were entered only as a fixed amount.
-- This lets legacy/test rows immediately show allocation percentage where mathematically possible.
update public.payment_milestones pm
set percentage = round((pm.fixed_amount / nullif(po.current_value,0)) * 100.0, 4)
from public.purchase_orders po
where pm.purchase_order_id = po.id
  and pm.percentage is null
  and pm.fixed_amount is not null
  and po.current_value > 0;

-- Keep project API access available.
grant select,insert,update,delete on public.projects to authenticated;

commit;
