-- MCCS 015_super_admin_delete_controls.sql
-- Super Admin go-live deletion controls for operational registers.
begin;

alter table public.payment_milestones
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

alter table public.payments
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

alter table public.documents
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

create index if not exists idx_payment_milestones_is_deleted on public.payment_milestones(is_deleted);
create index if not exists idx_payments_is_deleted on public.payments(is_deleted);
create index if not exists idx_documents_is_deleted on public.documents(is_deleted);

commit;
