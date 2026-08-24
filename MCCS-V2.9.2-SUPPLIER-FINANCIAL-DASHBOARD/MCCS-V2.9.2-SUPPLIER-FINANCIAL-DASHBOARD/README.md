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

## V2.9.2 Supplier / Contractor Financial Dashboard

The executive dashboard now includes a Supplier / Contractor dropdown. Selecting a supplier automatically filters the dashboard and shows:

- Total PO / commitment value by currency
- Paid-to-date value and number of actual payment transactions
- Remaining-to-pay value by currency
- Next payment due date
- Paid payment history with payment date, PO, amount and reference
- Remaining payment schedule with due date, PO, milestone and calculated amount

The existing multi-currency logic is preserved: different currencies are never combined into a single total.

No new Supabase migration is required for this dashboard enhancement.

If this folder is uploaded to the GitHub repository as one folder, set the Vercel Root Directory to:

`MCCS-V2.9.2-SUPPLIER-FINANCIAL-DASHBOARD`
