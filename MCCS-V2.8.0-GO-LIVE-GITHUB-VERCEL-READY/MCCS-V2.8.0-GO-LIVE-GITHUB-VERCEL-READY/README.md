# MCCS V2.8.0 — Go-Live Package

Miran Commercial Control System production upgrade focused on live operations, historical migration, global search, Super Admin controls and Miran Purchase Order PDF output.

## V2.8.0 features

- Global search in the top header across Vendors, Projects / Packages, Purchase Orders, RFQ references, Invoices, Payments, Milestones and Documents.
- Search supports commercial reference text and exact monetary amounts.
- Super Admin audit-safe delete controls for Purchase Orders, Invoices (existing control), Projects / Packages and Vendors.
- Controlled Historical Data Import workbook for a project that is already in progress.
- Historical workbook covers Vendors, Projects / Packages, Purchase Orders, Payment Milestones, Invoices and Payments.
- Downloadable historical import Excel template from Administration → Historical Data Import.
- Miran Purchase Order PDF export from each PO record.
- PO first page is based on the supplied Miran Purchase Order layout.
- Pages 2 and 3 preserve the supplied Miran Terms & Conditions wording/layout; supplier stamp/signature images were removed from the bundled reusable template.
- PO print fields are editable in MCCS: payment terms, delivery terms/date, Incoterm, origin, warranty, quote reference/date, shipping/billing addresses, discount, extra, prepared by and other instructions.
- Editable PO line items with item code, description, site, UOM, quantity and unit cost.
- Existing Google Drive vendor/project/PO/invoice hierarchy remains in place.

## Required Supabase step before deployment

Run the new migration after migrations 009–013:

`supabase/migrations/014_go_live_controls.sql`

This adds PO print fields, PO line items, and audit-safe delete metadata for Projects / Packages and Vendors.

## GitHub / Vercel deployment

Upload the complete folder to the root of your GitHub repository.

If GitHub is structured as:

```
miran-commercial-control-system/
└── MCCS-V2.8.0-GO-LIVE-GITHUB-VERCEL-READY/
    ├── app/
    ├── components/
    ├── lib/
    ├── public/
    ├── supabase/
    ├── package.json
    └── ...
```

set Vercel Root Directory to exactly:

`MCCS-V2.8.0-GO-LIVE-GITHUB-VERCEL-READY`

Keep Framework Preset = Next.js and Build/Output/Install commands on Vercel defaults.

## Existing environment variables

Keep the current Supabase and Google Drive environment variables, including:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

No new environment variable is required for V2.8.0.

## Historical data go-live procedure

1. Administration → Historical Data Import.
2. Download `MCCS-Historical-Import-Template.xlsx`.
3. Complete the sheets without renaming the headers.
4. Upload the workbook and enter the historical cut-off/source reference.
5. Review dashboard/register totals after import.
6. Upload legacy physical documents separately through Documents so they are placed in Google Drive.

## PO PDF

Open a Purchase Order and use `Export Miran PO PDF`.

The generated document uses the editable MCCS PO master data and line items on page 1, followed by the controlled Miran Terms & Conditions pages for printing.
