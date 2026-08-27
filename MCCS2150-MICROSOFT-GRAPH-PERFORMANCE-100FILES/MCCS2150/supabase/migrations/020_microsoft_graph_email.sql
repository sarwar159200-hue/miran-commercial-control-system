-- MCCS 2.15.0 - Microsoft Graph OAuth credential store.
-- Server/service-role only: no browser/user policies are intentionally granted.
create table if not exists public.mccs_email_oauth (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  email_address text,
  refresh_token text not null,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mccs_email_oauth enable row level security;
revoke all on table public.mccs_email_oauth from anon, authenticated;
