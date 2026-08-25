-- MCCS V2.12.0 - Integrated VDRL / MDR module
-- Safe, additive migration. Reuses existing vendors/projects/profiles and does not delete production data.
begin;

create extension if not exists pgcrypto;

create or replace function public.vdrl_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_super_admin,false) = true and coalesce(p.is_active,true) = true
  ) or lower(coalesce(auth.jwt()->>'email','')) = 'sarwar.khalid@miranenergy.com';
$$;

grant execute on function public.vdrl_is_super_admin() to authenticated;

create table if not exists public.vdrl_settings (
  id integer primary key default 1 check (id = 1),
  review_cycle_days integer not null default 5 check (review_cycle_days between 1 and 60),
  data_date_override date,
  auto_sync boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.vdrl_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.vdrl_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default 'blue',
  sequence_no integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.vdrl_stages(code,name,color,sequence_no) values
  ('IFA','Issued for Approval','blue',10),
  ('IFR','Issued for Review','emerald',20),
  ('IFC','Issued for Construction','orange',30),
  ('IFD','Issued for Design','violet',40),
  ('IFI','Issued for Information','slate',50),
  ('IFT','Issued for Tender','amber',60),
  ('IFQ','Issued for Quotation','cyan',70),
  ('AS-BUILT','As-Built','indigo',80),
  ('FINAL','Final','emerald',90),
  ('APPROVED','Approved','emerald',100)
on conflict (code) do nothing;

create table if not exists public.vdrl_return_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  approved boolean not null default false,
  resubmission_required boolean not null default false,
  close_document boolean not null default false,
  next_stage text,
  color text not null default 'slate',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.vdrl_return_codes(code,description,approved,resubmission_required,close_document,next_stage,color) values
  ('C1','Approved',true,false,true,null,'emerald'),
  ('C2','Approved with Comments',true,false,true,null,'emerald'),
  ('C3','Revise and Resubmit',false,true,false,null,'orange'),
  ('C4','Rejected / Not Approved',false,true,false,null,'red')
on conflict (code) do nothing;

create table if not exists public.vdrl_registers (
  id uuid primary key default gen_random_uuid(),
  register_name text not null,
  supplier_id uuid not null references public.vendors(id) on delete restrict,
  contractor_id uuid references public.vendors(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  package_id uuid references public.projects(id) on delete set null,
  status text not null default 'active',
  current_batch_id uuid,
  current_original_file_id text,
  current_original_folder_id text,
  current_controlled_file_id text,
  current_controlled_folder_id text,
  last_sync_at timestamptz,
  last_successful_backup_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique(supplier_id, package_id)
);

create table if not exists public.vdrl_upload_batches (
  id uuid primary key default gen_random_uuid(),
  register_id uuid references public.vdrl_registers(id) on delete cascade,
  supplier_id uuid not null references public.vendors(id) on delete restrict,
  contractor_id uuid references public.vendors(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  package_id uuid references public.projects(id) on delete set null,
  upload_mode text not null default 'new' check (upload_mode in ('new','update')),
  status text not null default 'preview' check (status in ('preview','mapping_required','confirmed','failed','cancelled')),
  original_file_name text not null,
  google_drive_file_id text,
  google_drive_folder_id text,
  google_drive_path text,
  headers jsonb not null default '[]'::jsonb,
  detected_mapping jsonb not null default '{}'::jsonb,
  mapping_confidence numeric(5,2) not null default 0,
  worksheet_name text,
  header_row integer,
  total_rows integer not null default 0,
  new_count integer not null default 0,
  changed_count integer not null default 0,
  unchanged_count integer not null default 0,
  missing_count integer not null default 0,
  invalid_count integer not null default 0,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  error_message text
);

alter table public.vdrl_registers
  drop constraint if exists vdrl_registers_current_batch_id_fkey;
alter table public.vdrl_registers
  add constraint vdrl_registers_current_batch_id_fkey foreign key (current_batch_id) references public.vdrl_upload_batches(id) on delete set null;

create table if not exists public.vdrl_upload_rows (
  id bigserial primary key,
  batch_id uuid not null references public.vdrl_upload_batches(id) on delete cascade,
  row_no integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  classification text not null default 'new' check (classification in ('new','changed','unchanged','invalid')),
  unique(batch_id,row_no)
);

create table if not exists public.vdrl_documents (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.vdrl_registers(id) on delete cascade,
  business_key text not null,
  document_number text not null,
  document_title text,
  supplier_id uuid not null references public.vendors(id) on delete restrict,
  contractor_id uuid references public.vendors(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  package_id uuid references public.projects(id) on delete set null,
  discipline text,
  sub_discipline text,
  document_type text,
  current_stage text,
  current_revision text,
  planned_submit_date date,
  actual_submit_date date,
  planned_return_date date,
  actual_return_date date,
  resubmission_due_date date,
  return_code text,
  current_status text not null default 'pending_submission',
  submission_variance integer,
  return_variance integer,
  days_overdue integer not null default 0,
  responsible_party text not null default 'Vendor',
  action_due_date date,
  source_batch_id uuid references public.vdrl_upload_batches(id) on delete set null,
  source_file_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique(register_id,business_key)
);

create table if not exists public.vdrl_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.vdrl_documents(id) on delete cascade,
  stage text,
  revision text,
  planned_submit_date date,
  actual_submit_date date,
  planned_return_date date,
  actual_return_date date,
  resubmission_due_date date,
  return_code text,
  status text,
  responsible_party text,
  source_batch_id uuid references public.vdrl_upload_batches(id) on delete set null,
  source_file_id text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.vdrl_mapping_templates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.vendors(id) on delete cascade,
  package_id uuid references public.projects(id) on delete cascade,
  template_name text not null,
  header_signature text,
  mapping jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(supplier_id,package_id,template_name)
);

create table if not exists public.vdrl_audit_history (
  id bigserial primary key,
  register_id uuid references public.vdrl_registers(id) on delete set null,
  document_id uuid references public.vdrl_documents(id) on delete set null,
  batch_id uuid references public.vdrl_upload_batches(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  user_role text,
  action text not null,
  supplier_id uuid references public.vendors(id) on delete set null,
  contractor_id uuid references public.vendors(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  package_id uuid references public.projects(id) on delete set null,
  document_number text,
  revision text,
  stage text,
  old_value jsonb,
  new_value jsonb,
  source text,
  google_drive_file_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.vdrl_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.vdrl_registers(id) on delete cascade,
  batch_id uuid references public.vdrl_upload_batches(id) on delete set null,
  job_type text not null default 'controlled_export',
  status text not null default 'queued' check (status in ('queued','processing','success','failed')),
  attempts integer not null default 0,
  last_error text,
  google_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempt_at timestamptz
);

create unique index if not exists uq_vdrl_register_supplier_package on public.vdrl_registers(supplier_id,package_id) where package_id is not null;
create unique index if not exists uq_vdrl_register_supplier_general on public.vdrl_registers(supplier_id) where package_id is null;
create index if not exists idx_vdrl_documents_register on public.vdrl_documents(register_id,is_active);
create index if not exists idx_vdrl_documents_supplier on public.vdrl_documents(supplier_id,is_active);
create index if not exists idx_vdrl_documents_package on public.vdrl_documents(package_id,is_active);
create index if not exists idx_vdrl_documents_stage on public.vdrl_documents(current_stage,is_active);
create index if not exists idx_vdrl_documents_status on public.vdrl_documents(current_status,is_active);
create index if not exists idx_vdrl_documents_plan_submit on public.vdrl_documents(planned_submit_date) where is_active;
create index if not exists idx_vdrl_documents_plan_return on public.vdrl_documents(planned_return_date) where is_active;
create index if not exists idx_vdrl_documents_action_due on public.vdrl_documents(action_due_date) where is_active;
create index if not exists idx_vdrl_upload_rows_batch on public.vdrl_upload_rows(batch_id,classification,row_no);
create index if not exists idx_vdrl_revisions_document on public.vdrl_revisions(document_id,created_at desc);
create index if not exists idx_vdrl_audit_document on public.vdrl_audit_history(document_id,created_at desc);
create index if not exists idx_vdrl_audit_register on public.vdrl_audit_history(register_id,created_at desc);
create index if not exists idx_vdrl_sync_status on public.vdrl_sync_jobs(status,created_at);

create or replace function public.vdrl_active_data_date()
returns date
language sql
stable
security definer
set search_path = public
as $$ select coalesce((select data_date_override from public.vdrl_settings where id=1), current_date); $$;

grant execute on function public.vdrl_active_data_date() to authenticated;

create or replace function public.vdrl_refresh_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := public.vdrl_active_data_date();
  changed integer := 0;
begin
  update public.vdrl_documents x
  set
    planned_return_date = case
      when x.actual_submit_date is not null and x.planned_return_date is null
      then x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)
      else x.planned_return_date end,
    submission_variance = case when x.actual_submit_date is not null and x.planned_submit_date is not null then x.actual_submit_date - x.planned_submit_date else null end,
    return_variance = case when x.actual_return_date is not null and x.planned_return_date is not null then x.actual_return_date - x.planned_return_date else null end,
    current_status = case
      when rc.close_document is true then 'approved'
      when x.actual_return_date is not null and rc.resubmission_required is true and x.resubmission_due_date is not null and d > x.resubmission_due_date then 'overdue_resubmission'
      when x.actual_return_date is not null and rc.resubmission_required is true then 'returned_for_revision'
      when x.actual_submit_date is null and x.planned_submit_date is not null and d > x.planned_submit_date then 'overdue_submission'
      when x.actual_submit_date is not null and x.actual_return_date is null and coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)) < d then 'overdue_return'
      when x.actual_submit_date is not null and x.actual_return_date is null then 'under_miran_review'
      when x.actual_submit_date is null then 'pending_submission'
      when x.actual_return_date is not null then 'returned'
      else 'active' end,
    responsible_party = case
      when rc.close_document is true then 'Closed'
      when x.actual_return_date is not null and rc.resubmission_required is true then 'Vendor'
      when x.actual_submit_date is null then 'Vendor'
      when x.actual_submit_date is not null and x.actual_return_date is null then 'Miran'
      else 'Closed' end,
    action_due_date = case
      when rc.close_document is true then null
      when x.actual_return_date is not null and rc.resubmission_required is true then x.resubmission_due_date
      when x.actual_submit_date is null then x.planned_submit_date
      when x.actual_submit_date is not null and x.actual_return_date is null then coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1))
      else null end,
    days_overdue = greatest(0, case
      when x.actual_return_date is not null and rc.resubmission_required is true and x.resubmission_due_date is not null and d > x.resubmission_due_date then d - x.resubmission_due_date
      when x.actual_submit_date is null and x.planned_submit_date is not null and d > x.planned_submit_date then d - x.planned_submit_date
      when x.actual_submit_date is not null and x.actual_return_date is null and coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)) < d then d - coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1))
      else 0 end),
    updated_at = now()
  from public.vdrl_return_codes rc
  where x.is_active = true and upper(coalesce(x.return_code,'')) = upper(rc.code);
  get diagnostics changed = row_count;

  update public.vdrl_documents x
  set
    planned_return_date = case when x.actual_submit_date is not null and x.planned_return_date is null then x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1) else x.planned_return_date end,
    submission_variance = case when x.actual_submit_date is not null and x.planned_submit_date is not null then x.actual_submit_date - x.planned_submit_date else null end,
    return_variance = case when x.actual_return_date is not null and x.planned_return_date is not null then x.actual_return_date - x.planned_return_date else null end,
    current_status = case
      when x.actual_submit_date is null and x.planned_submit_date is not null and d > x.planned_submit_date then 'overdue_submission'
      when x.actual_submit_date is not null and x.actual_return_date is null and coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)) < d then 'overdue_return'
      when x.actual_submit_date is not null and x.actual_return_date is null then 'under_miran_review'
      when x.actual_submit_date is null then 'pending_submission'
      when x.actual_return_date is not null then 'returned'
      else 'active' end,
    responsible_party = case when x.actual_submit_date is null then 'Vendor' when x.actual_submit_date is not null and x.actual_return_date is null then 'Miran' else 'Closed' end,
    action_due_date = case when x.actual_submit_date is null then x.planned_submit_date when x.actual_submit_date is not null and x.actual_return_date is null then coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)) else null end,
    days_overdue = greatest(0, case
      when x.actual_submit_date is null and x.planned_submit_date is not null and d > x.planned_submit_date then d - x.planned_submit_date
      when x.actual_submit_date is not null and x.actual_return_date is null and coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1)) < d then d - coalesce(x.planned_return_date, x.actual_submit_date + (select review_cycle_days from public.vdrl_settings where id=1))
      else 0 end),
    updated_at = now()
  where x.is_active = true and not exists(select 1 from public.vdrl_return_codes rc where upper(rc.code)=upper(coalesce(x.return_code,'')));
  return changed;
end;
$$;

grant execute on function public.vdrl_refresh_statuses() to authenticated;

create or replace function public.vdrl_apply_batch(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.vdrl_upload_batches%rowtype;
  r record;
  doc public.vdrl_documents%rowtype;
  key text;
  incoming_keys text[] := array[]::text[];
  new_n int := 0; changed_n int := 0; unchanged_n int := 0; invalid_n int := 0; missing_n int := 0;
begin
  if not public.vdrl_is_super_admin() then raise exception 'Super Admin permission is required.'; end if;
  select * into b from public.vdrl_upload_batches where id=p_batch for update;
  if not found then raise exception 'VDRL upload batch not found.'; end if;
  if b.status not in ('preview','mapping_required') then raise exception 'Batch is not awaiting confirmation.'; end if;

  for r in select * from public.vdrl_upload_rows where batch_id=p_batch order by row_no loop
    if jsonb_array_length(r.validation_errors) > 0 then invalid_n := invalid_n + 1; continue; end if;
    key := upper(trim(coalesce(r.mapped_data->>'document_number','')));
    if key='' then invalid_n := invalid_n + 1; continue; end if;
    incoming_keys := array_append(incoming_keys,key);
    select * into doc from public.vdrl_documents where register_id=b.register_id and business_key=key for update;
    if found then
      if r.classification='changed' then
        insert into public.vdrl_revisions(document_id,stage,revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,resubmission_due_date,return_code,status,responsible_party,source_batch_id,source_file_id,snapshot,created_by)
        values(doc.id,doc.current_stage,doc.current_revision,doc.planned_submit_date,doc.actual_submit_date,doc.planned_return_date,doc.actual_return_date,doc.resubmission_due_date,doc.return_code,doc.current_status,doc.responsible_party,doc.source_batch_id,doc.source_file_id,to_jsonb(doc),auth.uid());
        insert into public.vdrl_audit_history(register_id,document_id,batch_id,user_id,user_role,action,supplier_id,contractor_id,project_id,package_id,document_number,revision,stage,old_value,new_value,source,google_drive_file_id)
        values(b.register_id,doc.id,p_batch,auth.uid(),'super_admin','VDRL Updated',b.supplier_id,b.contractor_id,b.project_id,b.package_id,doc.document_number,doc.current_revision,doc.current_stage,to_jsonb(doc),r.mapped_data,'Excel Upload',b.google_drive_file_id);
        changed_n := changed_n + 1;
      else unchanged_n := unchanged_n + 1;
      end if;
      update public.vdrl_documents set
        document_number=coalesce(nullif(r.mapped_data->>'document_number',''),document_number),
        document_title=coalesce(nullif(r.mapped_data->>'document_title',''),document_title),
        discipline=coalesce(nullif(r.mapped_data->>'discipline',''),discipline),
        sub_discipline=coalesce(nullif(r.mapped_data->>'sub_discipline',''),sub_discipline),
        document_type=coalesce(nullif(r.mapped_data->>'document_type',''),document_type),
        current_stage=coalesce(nullif(r.mapped_data->>'stage',''),current_stage),
        current_revision=coalesce(nullif(r.mapped_data->>'revision',''),current_revision),
        planned_submit_date=coalesce(nullif(r.mapped_data->>'planned_submit_date','')::date,planned_submit_date),
        actual_submit_date=coalesce(nullif(r.mapped_data->>'actual_submit_date','')::date,actual_submit_date),
        planned_return_date=coalesce(nullif(r.mapped_data->>'planned_return_date','')::date,planned_return_date),
        actual_return_date=coalesce(nullif(r.mapped_data->>'actual_return_date','')::date,actual_return_date),
        resubmission_due_date=coalesce(nullif(r.mapped_data->>'resubmission_due_date','')::date,resubmission_due_date),
        return_code=coalesce(nullif(r.mapped_data->>'return_code',''),return_code),
        source_batch_id=p_batch, source_file_id=b.google_drive_file_id, is_active=true, updated_at=now(), updated_by=auth.uid()
      where id=doc.id;
    else
      insert into public.vdrl_documents(register_id,business_key,document_number,document_title,supplier_id,contractor_id,project_id,package_id,discipline,sub_discipline,document_type,current_stage,current_revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,resubmission_due_date,return_code,source_batch_id,source_file_id,created_by,updated_by)
      values(b.register_id,key,r.mapped_data->>'document_number',r.mapped_data->>'document_title',b.supplier_id,b.contractor_id,b.project_id,b.package_id,r.mapped_data->>'discipline',r.mapped_data->>'sub_discipline',r.mapped_data->>'document_type',r.mapped_data->>'stage',r.mapped_data->>'revision',nullif(r.mapped_data->>'planned_submit_date','')::date,nullif(r.mapped_data->>'actual_submit_date','')::date,nullif(r.mapped_data->>'planned_return_date','')::date,nullif(r.mapped_data->>'actual_return_date','')::date,nullif(r.mapped_data->>'resubmission_due_date','')::date,r.mapped_data->>'return_code',p_batch,b.google_drive_file_id,auth.uid(),auth.uid()) returning * into doc;
      insert into public.vdrl_audit_history(register_id,document_id,batch_id,user_id,user_role,action,supplier_id,contractor_id,project_id,package_id,document_number,revision,stage,new_value,source,google_drive_file_id)
      values(b.register_id,doc.id,p_batch,auth.uid(),'super_admin','New Document Added',b.supplier_id,b.contractor_id,b.project_id,b.package_id,doc.document_number,doc.current_revision,doc.current_stage,r.mapped_data,'Excel Upload',b.google_drive_file_id);
      new_n := new_n + 1;
    end if;
  end loop;

  if b.upload_mode='update' then
    insert into public.vdrl_audit_history(register_id,document_id,batch_id,user_id,user_role,action,supplier_id,contractor_id,project_id,package_id,document_number,revision,stage,old_value,source,google_drive_file_id)
    select b.register_id,d.id,p_batch,auth.uid(),'super_admin','Document Missing in Updated VDRL',b.supplier_id,b.contractor_id,b.project_id,b.package_id,d.document_number,d.current_revision,d.current_stage,to_jsonb(d),'Excel Upload',b.google_drive_file_id
    from public.vdrl_documents d
    where d.register_id=b.register_id and d.is_active=true and not (d.business_key = any(incoming_keys));
    update public.vdrl_documents set is_active=false, updated_at=now(), updated_by=auth.uid()
    where register_id=b.register_id and is_active=true and not (business_key = any(incoming_keys));
    get diagnostics missing_n = row_count;
  end if;

  perform public.vdrl_refresh_statuses();
  update public.vdrl_upload_batches set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid(),new_count=new_n,changed_count=changed_n,unchanged_count=unchanged_n,missing_count=missing_n,invalid_count=invalid_n where id=p_batch;
  update public.vdrl_registers set current_batch_id=p_batch,status='active',updated_at=now(),updated_by=auth.uid() where id=b.register_id;
  insert into public.vdrl_audit_history(register_id,batch_id,user_id,user_role,action,supplier_id,contractor_id,project_id,package_id,new_value,source,google_drive_file_id)
  values(b.register_id,p_batch,auth.uid(),'super_admin','VDRL Confirmed',b.supplier_id,b.contractor_id,b.project_id,b.package_id,jsonb_build_object('new',new_n,'changed',changed_n,'unchanged',unchanged_n,'missing',missing_n,'invalid',invalid_n),'Excel Upload',b.google_drive_file_id);
  return jsonb_build_object('new',new_n,'changed',changed_n,'unchanged',unchanged_n,'missing',missing_n,'invalid',invalid_n);
end;
$$;

grant execute on function public.vdrl_apply_batch(uuid) to authenticated;

-- RLS: authenticated read; Super Admin writes.
do $$
declare t text;
begin
  foreach t in array array['vdrl_settings','vdrl_stages','vdrl_return_codes','vdrl_registers','vdrl_upload_batches','vdrl_upload_rows','vdrl_documents','vdrl_revisions','vdrl_mapping_templates','vdrl_audit_history','vdrl_sync_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='vdrl_read_authenticated') then
      execute format('create policy vdrl_read_authenticated on public.%I for select to authenticated using (true)',t);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='vdrl_write_super_admin') then
      execute format('create policy vdrl_write_super_admin on public.%I for all to authenticated using (public.vdrl_is_super_admin()) with check (public.vdrl_is_super_admin())',t);
    end if;
  end loop;
end $$;

grant usage,select on sequence public.vdrl_upload_rows_id_seq to authenticated,service_role;
grant usage,select on sequence public.vdrl_audit_history_id_seq to authenticated,service_role;

commit;

select public.vdrl_refresh_statuses();
