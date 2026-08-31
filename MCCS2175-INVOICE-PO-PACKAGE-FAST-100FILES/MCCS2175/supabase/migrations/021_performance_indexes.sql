-- MCCS 2.15.1 performance hotfix. Safe/idempotent indexes only.
create index if not exists idx_purchase_orders_vendor_not_deleted on public.purchase_orders(vendor_id) where is_deleted = false;
create index if not exists idx_purchase_orders_project_not_deleted on public.purchase_orders(project_id) where is_deleted = false;
create index if not exists idx_payment_milestones_po_not_deleted on public.payment_milestones(purchase_order_id) where is_deleted = false;
create index if not exists idx_payment_milestones_due_not_deleted on public.payment_milestones(payment_due_date) where is_deleted = false;
create index if not exists idx_invoices_po_not_deleted on public.invoices(purchase_order_id) where is_deleted = false;
create index if not exists idx_payments_po_not_deleted on public.payments(purchase_order_id) where is_deleted = false;
create index if not exists idx_payments_milestone_not_deleted on public.payments(payment_milestone_id) where is_deleted = false;
create index if not exists idx_projects_vendor_not_deleted on public.projects(vendor_id) where is_deleted = false;
create index if not exists idx_chat_messages_recipient_unread on public.chat_messages(recipient_id, created_at desc) where read_at is null;
create index if not exists idx_chat_calls_participants_status on public.chat_calls(status, created_at desc);

-- MCCS 2.17.0: optional actual payment date captured against each milestone.
alter table if exists public.payment_milestones
  add column if not exists actual_payment_date date;
create index if not exists idx_payment_milestones_actual_payment_date_not_deleted
  on public.payment_milestones(actual_payment_date) where is_deleted = false;
