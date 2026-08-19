
-- MCCS V1.9 Near-Go-Live
-- Run AFTER 001_foundation.sql in Supabase SQL Editor.

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists gender text,
  add column if not exists honorific text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_login_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_gender_check'
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('male','female','other','prefer_not_to_say'));
  end if;
end $$;

-- Create profiles automatically for future Auth users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    preferred_name,
    gender,
    honorific,
    is_super_admin,
    is_active,
    created_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'honorific',
    false,
    true,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mccs on auth.users;
create trigger on_auth_user_created_mccs
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill profiles for existing Auth users.
insert into public.profiles (id, full_name, preferred_name, is_active, created_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'preferred_name', split_part(u.email, '@', 1)),
  true,
  now()
from auth.users u
on conflict (id) do nothing;

-- Bootstrap Sarwar as initial Super Admin.
update public.profiles p
set
  full_name = 'Sarwar Khalid',
  preferred_name = 'Sarwar',
  gender = 'male',
  honorific = 'Kak',
  is_super_admin = true,
  is_active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('sarwar.khalid@miranenergy.com');

-- User can read own profile; Super Admin can read all profiles.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Super Admin write access to master data.
drop policy if exists "super admin manage vendors" on public.vendors;
create policy "super admin manage vendors"
on public.vendors for all
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
);

drop policy if exists "super admin manage purchase orders" on public.purchase_orders;
create policy "super admin manage purchase orders"
on public.purchase_orders for all
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
);

drop policy if exists "super admin manage currencies" on public.currencies;
create policy "super admin manage currencies"
on public.currencies for all
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
);

-- Presence heartbeat.
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
$$;

grant execute on function public.touch_presence() to authenticated;

-- Super Admin online-users view.
create or replace view public.online_users as
select
  p.id,
  p.full_name,
  p.preferred_name,
  p.job_title,
  p.department,
  p.is_super_admin,
  p.last_seen_at,
  u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.is_active = true
  and p.last_seen_at is not null
  and p.last_seen_at >= now() - interval '2 minutes';

-- Auditing helper.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), tg_table_name, new.id, 'CREATE', null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), tg_table_name, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), tg_table_name, old.id, 'DELETE', to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists vendors_audit_mccs on public.vendors;
create trigger vendors_audit_mccs
after insert or update or delete on public.vendors
for each row execute function public.audit_row_change();

drop trigger if exists purchase_orders_audit_mccs on public.purchase_orders;
create trigger purchase_orders_audit_mccs
after insert or update or delete on public.purchase_orders
for each row execute function public.audit_row_change();

-- Super Admin can read audit logs.
drop policy if exists "super admin read audit logs" on public.audit_logs;
create policy "super admin read audit logs"
on public.audit_logs for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_super_admin = true and me.is_active = true
  )
);

-- Allow authenticated users to insert audit events attributed to themselves.
drop policy if exists "authenticated insert audit logs" on public.audit_logs;
create policy "authenticated insert audit logs"
on public.audit_logs for insert
to authenticated
with check (actor_user_id = auth.uid());

-- Keep ordinary authenticated reads of master data from package 01.
-- Existing policies are left in place.
