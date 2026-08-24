# MCCS V2.9.6 — Clickable Report KPIs + Administration Security

This release builds on V2.9.5.

## V2.9.6 additions

- Report KPI cards are now clickable.
- Active POs opens the live PO list behind the KPI.
- Invoices opens the live invoice list.
- Payments opens the live payment list.
- Overdue Invoices opens only overdue invoice records.
- Each list includes direct links to the underlying commercial record where applicable.
- Administration navigation is shown only to Admin and Super Admin users.
- `/admin` and all nested Administration routes are server-side protected; non-admin users are redirected to Dashboard even if they manually type the URL.
- Admin role detection uses `user_roles` + `roles.role_code = admin`; Super Admin continues to use the existing Super Admin flag/bootstrap logic.

No new Supabase migration is required.
