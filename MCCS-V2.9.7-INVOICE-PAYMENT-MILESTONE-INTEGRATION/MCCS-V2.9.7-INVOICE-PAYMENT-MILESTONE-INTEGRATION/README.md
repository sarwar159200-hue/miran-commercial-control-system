# MCCS V2.9.7 — Invoice / Payment / Milestone Integration

Miran Commercial Control System production release built on V2.9.6.

## V2.9.7 additions

- Invoice PO selector now shows **PO Number — Supplier / Contractor**.
- Invoice milestone selector is dynamically filtered to only milestones belonging to the selected PO.
- Vendor is automatically resolved from the selected PO and displayed on invoice registration.
- PO Edit now contains an integrated **Payment Milestones** editor.
  - Edit existing milestones.
  - Add new milestones.
  - Edit percentage, fixed amount, milestone due date, payment due date and status.
  - Prevent total percentage allocation above 100%.
- Payment PO selector shows **PO Number — Supplier / Contractor**.
- Payment invoice selector is filtered to the selected PO and shows supplier / contractor.
- New **Payment Milestone** selector on Record Payment and Edit Payment.
- Selecting a milestone automatically fills its outstanding payable amount.
- Super Admin may override the auto-filled actual payment amount before saving.
- Payments are stored with a direct milestone link for accurate milestone settlement tracking.
- Dashboard next-payment calculation now prioritizes direct milestone-linked payments while preserving legacy oldest-first allocation for historical unlinked payments.

## Mandatory Supabase migration

Run this migration before using the new payment-milestone link:

`supabase/migrations/016_payment_milestone_link.sql`

## Vercel

If this folder is uploaded as a single folder under the GitHub repository root, set Vercel Root Directory to:

`MCCS-V2.9.7-INVOICE-PAYMENT-MILESTONE-INTEGRATION`

Keep Framework Preset = Next.js and build/install/output commands at Vercel defaults.
