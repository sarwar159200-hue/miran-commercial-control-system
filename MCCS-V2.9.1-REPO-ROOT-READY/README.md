# MCCS V2.9.0 — Final Go-Live / Super Admin Controlled Delete

Miran Commercial Control System production package.

## V2.9.0 go-live additions
- Super Admin Delete controls on Vendors, Projects & Packages, Purchase Orders, Payment Milestones, Invoices, Payments and Documents.
- Before deletion, MCCS calculates and displays linked-record consequences.
- Confirmation requires a deletion reason and typing the exact record name/number.
- Deletion is audit-safe soft delete: active registers, dashboard, reports, global search and Excel export exclude deleted operational records.
- Google Drive files are retained when a document metadata record is deleted.
- Audit log entries are written for controlled deletions where the MCCS audit table is available.

## Mandatory database step
Run Supabase migration after the existing migrations:

`supabase/migrations/015_super_admin_delete_controls.sql`

This adds soft-delete fields to Payment Milestones, Payments and Documents.

## Deployment
Upload this project folder to GitHub and set Vercel Root Directory to the folder that directly contains `package.json`. Keep Framework Preset = Next.js and build/install/output commands on Default.

## Existing V2.8 go-live capabilities retained
- Global commercial search
- Historical data import
- Vendor → Project/Package → PO/Invoice/SRF/Other Document Google Drive hierarchy
- Miran PO PDF export
- Commercial Excel export
