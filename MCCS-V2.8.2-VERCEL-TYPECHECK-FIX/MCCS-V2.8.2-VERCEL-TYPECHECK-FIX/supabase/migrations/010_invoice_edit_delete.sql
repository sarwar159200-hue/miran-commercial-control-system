-- MCCS 010_invoice_edit_delete.sql
-- Run after 009_invoice_assurance_workflow.sql
-- Adds audit-safe invoice deletion/archive fields.

begin;

alter table public.invoices
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

create index if not exists idx_invoices_is_deleted
  on public.invoices(is_deleted);

grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

-- Existing RLS remains in force. Super Admin update rights are already
-- used by MCCS for invoice editing/deletion.

commit;
