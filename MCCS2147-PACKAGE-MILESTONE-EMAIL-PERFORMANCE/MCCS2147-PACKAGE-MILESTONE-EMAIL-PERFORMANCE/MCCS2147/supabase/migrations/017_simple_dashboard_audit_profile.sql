-- MCCS V2.10.1 simple dashboard/audit/profile upgrade
begin;

alter table public.profiles add column if not exists avatar_url text;

-- Automatically record inserts/updates/deletes on core commercial registers.
-- Existing application-level audit entries remain valid; this trigger closes gaps.
create or replace function public.mccs_audit_core_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity uuid;
  act text;
begin
  if tg_op = 'DELETE' then
    entity := (to_jsonb(old)->>'id')::uuid;
  else
    entity := (to_jsonb(new)->>'id')::uuid;
  end if;
  act := upper(tg_op) || '_' || upper(tg_table_name);
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),tg_table_name,entity,act,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op = 'DELETE' then return old; else return new; end if;
exception when others then
  -- Audit logging must never block an operational transaction.
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare t text; trg text;
begin
  foreach t in array array['vendors','projects','purchase_orders','payment_milestones','invoices','payments','documents'] loop
    trg := 'trg_mccs_audit_' || t;
    execute format('drop trigger if exists %I on public.%I', trg, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.mccs_audit_core_changes()', trg, t);
  end loop;
end $$;

commit;
