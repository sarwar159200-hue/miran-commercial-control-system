# MCCS V2.9.4 — Supplier Milestone Bulk Edit

This release builds on V2.9.3 and adds a supplier/contractor-based bulk payment milestone editor.

## V2.9.4 additions
- Supplier / Contractor dropdown on Payment Milestones.
- Filter milestone cards and register by selected supplier.
- Super Admin bulk editor for every active milestone belonging to the selected supplier.
- Edit milestone name, percentage, fixed amount, milestone due date, payment due date and status in one screen.
- Save all selected supplier milestones with one action.
- Validation prevents percentages above 100% per PO.
- Existing individual Edit and controlled Delete remain available.

## Deployment
If this whole folder is uploaded under the same name in GitHub, set Vercel Root Directory to:

`MCCS-V2.9.4-SUPPLIER-MILESTONE-BULK-EDIT`

No new Supabase migration is required.
