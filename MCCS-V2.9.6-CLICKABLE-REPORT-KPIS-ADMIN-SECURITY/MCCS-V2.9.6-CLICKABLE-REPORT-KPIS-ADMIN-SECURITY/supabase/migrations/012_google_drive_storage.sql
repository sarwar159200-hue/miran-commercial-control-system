-- MCCS 012_google_drive_storage.sql
-- Run after 011_microsoft_storage.sql.
-- Replaces active document storage with Google Drive while preserving legacy Microsoft metadata.

begin;

create table if not exists public.google_drive_config (
  id integer primary key check (id = 1),
  refresh_token text not null,
  root_folder_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_config enable row level security;
revoke all on public.google_drive_config from anon, authenticated;
grant all on public.google_drive_config to service_role;

alter table public.documents
  add column if not exists project_id uuid,
  add column if not exists invoice_id uuid,
  add column if not exists document_title text,
  add column if not exists google_drive_file_id text,
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_path text,
  add column if not exists google_drive_web_url text;

-- Add foreign keys only when they do not already exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_project_id_fkey') then
    alter table public.documents add constraint documents_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_invoice_id_fkey') then
    alter table public.documents add constraint documents_invoice_id_fkey foreign key (invoice_id) references public.invoices(id) on delete set null;
  end if;
end $$;

create index if not exists idx_documents_project_id on public.documents(project_id);
create index if not exists idx_documents_invoice_id on public.documents(invoice_id);
create index if not exists idx_documents_google_drive_file_id on public.documents(google_drive_file_id);

-- New metadata-only records should no longer inherit the old Microsoft default.
alter table public.documents alter column storage_provider set default 'metadata_only';

-- Keep legacy records untouched; new uploads explicitly use google_drive.
commit;
