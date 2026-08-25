-- MCCS 013_vendor_project_drive_hierarchy.sql
-- Vendor -> Commercial Project/Package -> PO / Invoice / SRF / Other Documents

begin;

alter table public.vendors
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_path text;

alter table public.projects
  add column if not exists vendor_id uuid,
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_path text;

alter table public.purchase_orders
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_path text;

alter table public.invoices
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_path text;

alter table public.documents
  add column if not exists document_category text default 'other_document';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_vendor_id_fkey') then
    alter table public.projects
      add constraint projects_vendor_id_fkey
      foreign key (vendor_id) references public.vendors(id) on delete set null;
  end if;
end $$;

create index if not exists idx_projects_vendor_id on public.projects(vendor_id);
create index if not exists idx_documents_document_category on public.documents(document_category);

commit;
