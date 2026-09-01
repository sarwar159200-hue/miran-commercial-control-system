-- MCCS 2.16 - Invoice package linkage
begin;

alter table public.invoices
  add column if not exists project_id uuid references public.projects(id) on delete set null;

update public.invoices i
set project_id = po.project_id
from public.purchase_orders po
where i.purchase_order_id = po.id
  and i.project_id is null;

create index if not exists idx_invoices_project_not_deleted
  on public.invoices(project_id) where is_deleted = false;

commit;
