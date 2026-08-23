# MCCS V2.5.0 — Google Drive Document Storage

Miran Commercial Control System (MCCS) commercial-control application.

## V2.5.0 storage upgrade

- Google Drive OAuth 2.0 storage integration (`drive.file` scope)
- Super Admin Google Drive connection page
- PO and Invoice supporting-document upload
- Document title, document type, contractor/vendor, project, PO, invoice, milestone and revision metadata
- Historical-document flag
- Google Drive file/folder IDs and web links recorded in Supabase
- Automatic Google Drive folder hierarchy by Project → Contractor → PO/Invoice
- PO and Invoice detail pages include **Attach Document** shortcuts
- Legacy Microsoft/OneDrive UI and API routes removed

## Required Vercel environment variables

Server only (never prefix with `NEXT_PUBLIC_`):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `SUPABASE_SERVICE_ROLE_KEY`

Existing Supabase client variables remain required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or the project's supported publishable-key variable

## Required migration

Run `supabase/migrations/012_google_drive_storage.sql` after the existing migrations.

## Google OAuth redirect URI

The Google OAuth client must contain this exact production redirect URI:

`https://miran-commercial-control-system.vercel.app/api/auth/google/`

After deployment and migration, sign in as Super Admin and open:

`Administration → Google Drive Configuration → Connect Google Drive`

Authorize using the Google account that owns/controls MCCS storage.
