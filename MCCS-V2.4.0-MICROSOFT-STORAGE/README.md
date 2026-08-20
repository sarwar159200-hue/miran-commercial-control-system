# MCCS V2.4.0 — Microsoft Storage

Miran Commercial Control System

## Upgrade
Run:
`supabase/migrations/011_microsoft_storage.sql`

## Vercel Root Directory
`MCCS-V2.4.0-MICROSOFT-STORAGE`

Output Directory: blank.

## New in V2.4
- Microsoft OneDrive / SharePoint live-ready integration
- Connection test
- Drive quota/details check
- MCCS folder initialization
- Direct commercial document upload
- Automatic folder hierarchy by Project / Vendor / PO / Document Type
- Microsoft web link stored in MCCS
- File size and MIME type stored in MCCS
- Historical document routing
- Existing dark mode retained

## Required Vercel server variables
- MICROSOFT_TENANT_ID
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- ONEDRIVE_DRIVE_ID
- ONEDRIVE_ROOT_FOLDER=MCCS

The package contains no Microsoft secret values.
