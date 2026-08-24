# MCCS V2.6.2 — GitHub + Vercel deployment

This package is intentionally **root-upload ready**.

## GitHub

Upload the **contents of this ZIP directly to the root of the existing GitHub repository**.
After upload, GitHub must show `package.json` at the same level as `app`, `components`, `lib`, `public`, `supabase`, and `vercel.json`.

Correct:

```
miran-commercial-control-system/
├── app/
├── components/
├── lib/
├── public/
├── supabase/
├── package.json
├── next.config.ts
├── tsconfig.json
└── vercel.json
```

Do not upload the files inside another version folder.

## Vercel project settings

- Framework Preset: **Next.js**
- Root Directory: **leave empty**
- Build Command: **Default**
- Output Directory: **Default**
- Install Command: **Default**
- Development Command: **Default**

After changing settings, redeploy without build cache.

## Required environment variables

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

Public Supabase variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the compatible publishable-key variable used by your deployment)

Never prefix Google secrets or the Supabase service-role key with `NEXT_PUBLIC_`.

## Supabase migrations

Run migrations in numerical order. For the Google Drive hierarchy upgrade, ensure at least:

- `012_google_drive_storage.sql`
- `013_vendor_project_drive_hierarchy.sql`

have been applied after your earlier schema migrations.
