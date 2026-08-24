# MCCS V2.9.8 — PO Edit + Milestone Management

This release builds on V2.9.7 and makes PO editing directly accessible from the Purchase Order register.

## V2.9.8 additions

- Super Admin now sees **Edit PO & Milestones** directly in the Purchase Order register.
- PO detail screen has an explicit **Edit PO & Milestones** action.
- PO edit screen edits the full PO commercial record and all existing payment milestones in one form.
- Existing milestones remain editable for milestone name, percentage, fixed amount, milestone due date, payment due date and status.
- **+ Add Milestone** adds new milestones during PO editing.
- PO and milestone changes are saved together using the existing controlled Super Admin server action.
- Existing invoice/payment/milestone integration from V2.9.7 remains unchanged.

## Deployment

If this folder is uploaded as one folder under the GitHub repository root, set Vercel Root Directory to:

`MCCS-V2.9.8-PO-EDIT-MILESTONE-MANAGEMENT`

Existing Supabase migration `016_payment_milestone_link.sql` from V2.9.7 remains required. No new migration is required for V2.9.8.
