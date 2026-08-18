-- MIRAN COMMERCIAL CONTROL SYSTEM - PACKAGE 01 FOUNDATION
-- Run in a fresh Supabase project SQL editor.

create extension if not exists pgcrypto;

create type public.vendor_relationship_type as enum (
  'direct_contractor',
  'subcontractor',
  'supplier',
  'consultant',
  'manufacturer',
  'service_provider'
);

create type public.po_status as enum (
  'draft',
  'active',
  'completed',
  'closed',
  'cancelled'
);

create type public.milestone_status as enum (
  'planned',
  'awaiting_evidence',
  'eligible',
  'awaiting_invoice',
  'under_verification',
  'certified',
  'submitted_to_ap',
  'paid',
  'on_hold',
  'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  job_title text,
  department text,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  project_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text,
  decimal_places int not null default 2 check (decimal_places between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

insert into public.currencies (code, name, symbol, decimal_places)
values
('USD','US Dollar','$',2),
('IQD','Iraqi Dinar','IQD',0),
('EUR','Euro','€',2),
('GBP','Pound Sterling','£',2)
on conflict (code) do nothing;

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_code text unique,
  vendor_name text not null,
  legal_name text,
  relationship_type public.vendor_relationship_type not null default 'supplier',
  parent_vendor_id uuid references public.vendors(id) on delete set null,
  country text,
  address text,
  contact_person text,
  email text,
  phone text,
  tax_number text,
  default_currency_id uuid references public.currencies(id),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  constraint vendor_not_own_parent check (id <> parent_vendor_id)
);

create index vendors_parent_idx on public.vendors(parent_vendor_id);
create index vendors_name_idx on public.vendors(vendor_name);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  vendor_id uuid not null references public.vendors(id),
  parent_contractor_id uuid references public.vendors(id),
  po_number text not null unique,
  pr_number text,
  rfq_number text,
  po_date date not null,
  approval_date date,
  approved_by_text text,
  currency_id uuid not null references public.currencies(id),
  original_value numeric(20,4) not null default 0,
  approved_variations numeric(20,4) not null default 0,
  current_value numeric(20,4) generated always as (original_value + approved_variations) stored,
  payment_terms text,
  delivery_terms text,
  delivery_due_date date,
  status public.po_status not null default 'draft',
  is_historical boolean not null default false,
  historical_source text,
  historical_imported_at timestamptz,
  historical_imported_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index purchase_orders_vendor_idx on public.purchase_orders(vendor_id);
create index purchase_orders_project_idx on public.purchase_orders(project_id);

create table public.po_revisions (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  revision_no text not null,
  revision_date date,
  value_change numeric(20,4) not null default 0,
  reason text,
  is_historical boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (purchase_order_id, revision_no)
);

create table public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  sequence_no int not null default 1,
  milestone_name text not null,
  milestone_description text,
  percentage numeric(9,4),
  fixed_amount numeric(20,4),
  planned_due_date date,
  forecast_due_date date,
  achieved_date date,
  invoice_due_date date,
  payment_due_date date,
  certified_date date,
  submitted_to_ap_date date,
  actual_paid_date date,
  discipline text,
  responsible_user_id uuid references public.profiles(id),
  verification_required boolean not null default true,
  retention_percentage numeric(9,4) not null default 0,
  advance_recovery_percentage numeric(9,4) not null default 0,
  status public.milestone_status not null default 'planned',
  is_historical boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  check (percentage is null or (percentage >= 0 and percentage <= 100)),
  check (fixed_amount is null or fixed_amount >= 0),
  check (retention_percentage >= 0 and retention_percentage <= 100),
  check (advance_recovery_percentage >= 0 and advance_recovery_percentage <= 100)
);

create index payment_milestones_po_idx on public.payment_milestones(purchase_order_id);
create index payment_milestones_due_idx on public.payment_milestones(payment_due_date);

create table public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null unique references public.purchase_orders(id) on delete cascade,
  historical_invoiced numeric(20,4) not null default 0,
  historical_certified numeric(20,4) not null default 0,
  historical_paid numeric(20,4) not null default 0,
  as_of_date date not null,
  evidence_reference text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id),
  purchase_order_id uuid references public.purchase_orders(id),
  milestone_id uuid references public.payment_milestones(id),
  document_type text not null,
  file_name text not null,
  onedrive_item_id text,
  onedrive_path text,
  revision text,
  is_historical boolean not null default false,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Useful view for PO milestone allocation.
create or replace view public.po_milestone_summary as
select
  po.id as purchase_order_id,
  po.po_number,
  po.current_value,
  coalesce(sum(pm.percentage), 0) as allocated_percentage,
  coalesce(sum(pm.fixed_amount), 0) as allocated_fixed_amount,
  count(pm.id) as milestone_count
from public.purchase_orders po
left join public.payment_milestones pm on pm.purchase_order_id = po.id
group by po.id, po.po_number, po.current_value;

-- RLS foundation
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.currencies enable row level security;
alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_revisions enable row level security;
alter table public.payment_milestones enable row level security;
alter table public.opening_balances enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;

-- Minimal Package 01 read policies for authenticated users.
-- Package 02 will replace these with role-based policies.
create policy "authenticated read projects" on public.projects
for select to authenticated using (true);

create policy "authenticated read currencies" on public.currencies
for select to authenticated using (true);

create policy "authenticated read vendors" on public.vendors
for select to authenticated using (true);

create policy "authenticated read purchase orders" on public.purchase_orders
for select to authenticated using (true);

create policy "authenticated read milestones" on public.payment_milestones
for select to authenticated using (true);
