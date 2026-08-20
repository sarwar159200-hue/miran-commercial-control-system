
-- MCCS V2.0 GO-LIVE CONTROLS
-- Run after 001_foundation.sql and 002_near_go_live.sql

-- PO lifecycle enhancements.
alter table public.purchase_orders
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists hold_reason text,
  add column if not exists held_at timestamptz,
  add column if not exists held_by uuid references public.profiles(id);

-- PostgreSQL enums cannot use IF NOT EXISTS directly for ADD VALUE in older patterns.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'po_status' and e.enumlabel = 'on_hold'
  ) then
    alter type public.po_status add value 'on_hold';
  end if;
end $$;

-- Role model.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_code text not null unique,
  role_name text not null,
  description text,
  is_active boolean not null default true
);

insert into public.roles (role_code, role_name, description)
values
  ('super_admin','Super Admin','Full MCCS administration'),
  ('commercial','Commercial','Commercial and invoice control'),
  ('discipline_engineer','Discipline Engineer','Technical verification and approval'),
  ('project_manager','Project Manager','Project review and approval'),
  ('accounts_payable','Accounts Payable','Payment processing visibility'),
  ('viewer','Viewer','Read-only reporting access')
on conflict (role_code) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  primary key (user_id, role_id)
);

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "authenticated read roles" on public.roles;
create policy "authenticated read roles"
on public.roles for select to authenticated using (true);

drop policy if exists "super admin manage user roles" on public.user_roles;
create policy "super admin manage user roles"
on public.user_roles for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
);

-- Ensure Sarwar profile remains the bootstrap Super Admin.
insert into public.profiles (id, full_name, preferred_name, gender, honorific, is_super_admin, is_active)
select
  u.id, 'Sarwar Khalid', 'Sarwar', 'male', 'Kak', true, true
from auth.users u
where lower(u.email) = lower('sarwar.khalid@miranenergy.com')
on conflict (id) do update set
  full_name = excluded.full_name,
  preferred_name = excluded.preferred_name,
  gender = excluded.gender,
  honorific = excluded.honorific,
  is_super_admin = true,
  is_active = true;

insert into public.user_roles (user_id, role_id, granted_by)
select p.id, r.id, p.id
from public.profiles p
cross join public.roles r
join auth.users u on u.id = p.id
where lower(u.email) = lower('sarwar.khalid@miranenergy.com')
  and r.role_code = 'super_admin'
on conflict do nothing;

-- Super Admin can manage projects/currencies.
drop policy if exists "super admin manage projects" on public.projects;
create policy "super admin manage projects"
on public.projects for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
);

-- Allow authenticated users to read PO revisions.
alter table public.po_revisions enable row level security;
drop policy if exists "authenticated read po revisions" on public.po_revisions;
create policy "authenticated read po revisions"
on public.po_revisions for select to authenticated using (true);

drop policy if exists "super admin manage po revisions" on public.po_revisions;
create policy "super admin manage po revisions"
on public.po_revisions for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
);

-- Milestones read/write.
drop policy if exists "super admin manage milestones" on public.payment_milestones;
create policy "super admin manage milestones"
on public.payment_milestones for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true and p.is_active = true
  )
);

-- Currency audit.
drop trigger if exists currencies_audit_mccs on public.currencies;
create trigger currencies_audit_mccs
after insert or update or delete on public.currencies
for each row execute function public.audit_row_change();

-- Milestone audit.
drop trigger if exists payment_milestones_audit_mccs on public.payment_milestones;
create trigger payment_milestones_audit_mccs
after insert or update or delete on public.payment_milestones
for each row execute function public.audit_row_change();
