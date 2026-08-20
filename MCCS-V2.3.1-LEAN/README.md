# MCCS V2.3.1 LEAN

Miran Commercial Control System

## Vercel
Root Directory:
`MCCS-V2.3.1-LEAN`

Output Directory:
leave blank

## Supabase
For this current upgrade, keep/run only if not already applied:
- `supabase/migrations/009_invoice_assurance_workflow.sql`
- `supabase/migrations/010_invoice_edit_delete.sql`

## Included
- Invoice assurance workflow
- Invoice edit
- Audit-safe invoice delete
- Checked By = user name only
- Existing MCCS dashboards, vendors, projects, POs, milestones, invoices, payments, users/roles, reports, documents, dark mode

This LEAN package intentionally removes old documentation and already-applied migration copies to keep the GitHub upload below 100 files.
