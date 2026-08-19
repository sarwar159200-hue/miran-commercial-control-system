# MCCS — Miran Commercial Control System — V1.6

This is the first foundation package for the Miran Energy Commercial Control, Procure-to-Pay & Invoice Assurance system.

## 1. Create a new GitHub repository

Recommended repository name:

`miran-commercial-control-system`

Recommended future URL:

`commercial.miranenergy.com`

Upload all files from this package to the repository root.

## 2. Create a new Supabase project

Open the Supabase SQL Editor and run:

`supabase/migrations/001_foundation.sql`

## 3. Environment variables

Copy `.env.example` to `.env.local` and add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not expose a Supabase service-role key in the browser.

## 4. Local run

```bash
npm install
npm run dev
```

## 5. Deploy to Vercel

Import the GitHub repository into Vercel and add the same Supabase environment variables.

## What this package establishes

The database is intentionally designed before the payment workflow UI.

Core concepts:
- Unlimited vendor hierarchy: ILF → Emerson → another supplier if needed.
- Unlimited currencies managed in the database.
- New and historical POs.
- Historical approval metadata.
- PO revisions.
- Opening balances for pre-system history.
- Unlimited payment milestones.
- Multiple due dates and actual dates.
- OneDrive metadata fields ready for Microsoft Graph integration.
- Audit log foundation.

## Important

Package 01 is a foundation package. It is not yet the production payment approval system.
Do not use it to certify live payments until the role/permission, approval workflow, audit, and Microsoft 365 packages are completed and tested.


## V1.6 build fix

V1.6 updates Next.js to 15.5.21 and supports the current Supabase publishable-key environment variable name.


## V1.6 TypeScript fix

Fixed the explicit typing of Supabase SSR cookie updates required by strict TypeScript builds on Vercel.


## V1.6 Vercel output fix

Added an explicit Next.js `vercel.json`. In Vercel, Output Directory must be blank; do not set it to `public`.


## V1.6

Added:
- Miran Energy logo on login and MCCS navigation
- Real Supabase email/password login
- Forgot Password
- Secure password recovery/update page
- Auth-protected dashboard area
- Sign out
- OneDrive/Microsoft Graph server configuration foundation
- OneDrive status page under Administration

Security note: the requested login password is **not embedded in source code**. Create the account in Supabase Authentication so the password is hashed and managed by Supabase Auth.


## V1.6

Fixed authenticated-route prerender failures on Vercel when Supabase environment variables are unavailable during build. Dashboard and OneDrive admin routes are now explicitly dynamic.


## V1.6

Premium login/dashboard redesign, password visibility toggle, improved navigation and cleaner Supabase configuration handling.
