-- MCCS 006_projects_and_po_detail_fix.sql
-- Run after 005_fix_data_api_grants.sql

begin;

-- Ensure authenticated access to projects and PO-related lookups.
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.purchase_orders to authenticated;
grant select on table public.vendors to authenticated;
grant select on table public.currencies to authenticated;
grant select, insert, update, delete on table public.payment_milestones to authenticated;
grant select, insert, update, delete on table public.po_revisions to authenticated;

-- Recreate safe project policies.
drop policy if exists "projects_manage_super_admin" on public.projects;
drop policy if exists "projects_select_authenticated" on public.projects;

create policy "projects_select_authenticated"
on public.projects
for select
to authenticated
using (true);

create policy "projects_manage_super_admin"
on public.projects
for all
to authenticated
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

-- Add project audit if audit helper exists.
drop trigger if exists projects_audit_mccs on public.projects;
create trigger projects_audit_mccs
after insert or update or delete on public.projects
for each row execute function public.audit_row_change();

commit;
