# MCCS V2.5.0 Deployment

1. Upload the package contents to the GitHub repository root.
2. Run `supabase/migrations/012_google_drive_storage.sql` in Supabase SQL Editor.
3. Confirm Vercel contains `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing Supabase public variables.
4. Confirm Google OAuth redirect URI is exactly:
   `https://miran-commercial-control-system.vercel.app/api/auth/google/`
5. Deploy/redeploy the Vercel Production build.
6. Sign in as MCCS Super Admin.
7. Open `Administration → Google Drive Configuration`.
8. Click `Connect Google Drive` and authorize the configured Google test account.
9. Confirm the page reports `Authorization: Connected`.
10. Open a PO or Invoice and click `Attach Document`, or use `Documents → Attach Document`.
11. Upload a small test PDF and confirm both the MCCS Documents register and Google Drive contain the file.

Note: the app requests Google's `drive.file` scope. If the manually configured root folder is not visible to this scope, MCCS automatically creates an app-accessible `MCCS - Miran Commercial Control` folder and stores that root ID securely in the server-only Google Drive configuration table.
