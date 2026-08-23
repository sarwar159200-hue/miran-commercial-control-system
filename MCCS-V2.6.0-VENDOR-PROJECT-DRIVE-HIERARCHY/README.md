# MCCS V2.6.0 — Vendor / Project Commercial Document Hierarchy

Google Drive commercial document management structure:

- Vendor / Contractor folder is created automatically when a vendor is created.
- A Commercial Project / Supply Package is created under the vendor, e.g. `Emerson / Supply PSV`.
- Each commercial project automatically contains:
  - `PO`
  - `Invoice`
  - `SRF`
  - `Other Documents`
- Each PO gets its own folder under `PO/<PO Number>`.
- Each invoice gets its own folder under `Invoice/<Invoice Number>`.
- PO creation supports delivery date, delivery terms, payment terms and payment milestones plus document upload.
- PO attachments include Purchase Order PDF, Technical Offer and multiple supporting documents.
- Invoice creation supports primary invoice file plus multiple supporting documents (PDF, Excel, images, ZIP, Word, CSV).
- Generic document upload can assign files to PO, Invoice, SRF or Other Documents.
- Google Drive metadata is registered in Supabase.

## Required migration

Run `supabase/migrations/013_vendor_project_drive_hierarchy.sql` after migration 012.

## Required Vercel variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- existing Supabase variables

## Folder example

```text
MCCS - Miran Commercial Control/
└── Emerson/
    └── Supply PSV/
        ├── PO/
        │   └── MEL-PO-001/
        │       ├── Purchase Order MEL-PO-001.pdf
        │       ├── Technical Offer.pdf
        │       └── Supporting Document.xlsx
        ├── Invoice/
        │   └── INV-001/
        │       ├── Invoice INV-001.pdf
        │       └── Supporting Documents...
        ├── SRF/
        └── Other Documents/
```
