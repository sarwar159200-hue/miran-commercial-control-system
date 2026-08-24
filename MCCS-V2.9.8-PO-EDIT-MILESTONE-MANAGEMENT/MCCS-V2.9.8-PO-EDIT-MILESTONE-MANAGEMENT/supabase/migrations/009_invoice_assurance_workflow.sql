-- MCCS V2.3.0 - Invoice Assurance & Approval Workflow
-- Run AFTER 008_history_edit_invoice_currency.sql
begin;

alter table public.invoices add column if not exists workflow_status text not null default 'received';
alter table public.invoices add column if not exists assigned_reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.invoices add column if not exists commercial_verifier_id uuid references public.profiles(id) on delete set null;
alter table public.invoices add column if not exists submitted_for_review_at timestamptz;
alter table public.invoices add column if not exists technical_approved_at timestamptz;
alter table public.invoices add column if not exists final_approved_at timestamptz;
alter table public.invoices add column if not exists submitted_to_ap_at timestamptz;
alter table public.invoices add column if not exists returned_at timestamptz;
alter table public.invoices add column if not exists return_reason text;
alter table public.invoices add column if not exists verification_ref text;

create table if not exists public.invoice_approvals (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  stage text not null,
  action text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  comments text,
  action_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_approvals_invoice on public.invoice_approvals(invoice_id, action_at);
create index if not exists idx_invoice_approvals_assigned on public.invoice_approvals(assigned_to, action_at);
create index if not exists idx_invoices_reviewer on public.invoices(assigned_reviewer_id, workflow_status);
create index if not exists idx_invoices_workflow on public.invoices(workflow_status);

alter table public.invoice_approvals enable row level security;
grant select,insert,update,delete on public.invoice_approvals to authenticated;
grant all on public.invoice_approvals to service_role;

drop policy if exists "invoice_approvals_read_authenticated" on public.invoice_approvals;
create policy "invoice_approvals_read_authenticated" on public.invoice_approvals
for select to authenticated using (true);

drop policy if exists "invoice_approvals_insert_participant" on public.invoice_approvals;
create policy "invoice_approvals_insert_participant" on public.invoice_approvals
for insert to authenticated with check (
  actor_user_id = auth.uid()
  or assigned_to = auth.uid()
  or public.current_user_is_super_admin()
);

drop policy if exists "invoice_approvals_update_participant" on public.invoice_approvals;
create policy "invoice_approvals_update_participant" on public.invoice_approvals
for update to authenticated using (
  actor_user_id = auth.uid()
  or assigned_to = auth.uid()
  or public.current_user_is_super_admin()
) with check (
  actor_user_id = auth.uid()
  or assigned_to = auth.uid()
  or public.current_user_is_super_admin()
);

-- Backfill workflow state from existing invoice status without destroying historical records.
update public.invoices
set workflow_status = case
  when lower(coalesce(status,'')) in ('submitted_to_ap','paid') then 'submitted_to_ap'
  when lower(coalesce(status,'')) in ('approved','approved_for_payment') then 'approved_for_payment'
  when lower(coalesce(status,'')) in ('under_verification','under_review') then 'under_verification'
  when lower(coalesce(status,'')) in ('on_hold','returned','rejected') then 'returned'
  else 'received'
end
where workflow_status is null or workflow_status = 'received';

-- Give each existing invoice a stable verification reference.
update public.invoices
set verification_ref = 'MCCS-IV-' || upper(regexp_replace(invoice_number, '[^A-Za-z0-9]+', '-', 'g'))
where verification_ref is null;

commit;

select invoice_number, workflow_status, verification_ref
from public.invoices
order by created_at desc nulls last;
