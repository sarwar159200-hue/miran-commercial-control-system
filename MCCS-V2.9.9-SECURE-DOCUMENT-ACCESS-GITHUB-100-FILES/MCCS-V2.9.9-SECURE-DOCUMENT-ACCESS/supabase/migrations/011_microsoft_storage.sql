-- MCCS 011_microsoft_storage.sql
-- Run after 010_invoice_edit_delete.sql
-- Adds Microsoft OneDrive / SharePoint storage metadata.

begin;

alter table public.documents
  add column if not exists onedrive_web_url text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists storage_provider text not null default 'microsoft_graph',
  add column if not exists storage_status text not null default 'metadata_only',
  add column if not exists storage_uploaded_at timestamptz;

create index if not exists idx_documents_onedrive_item_id
  on public.documents(onedrive_item_id);

create index if not exists idx_documents_storage_status
  on public.documents(storage_status);

grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;

commit;
