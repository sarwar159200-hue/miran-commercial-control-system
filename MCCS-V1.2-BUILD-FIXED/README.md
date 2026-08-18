# MCCS — Miran Commercial Control System — V1.2

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


## V1.2 build fix

V1.2 updates Next.js to 15.5.21 and supports the current Supabase publishable-key environment variable name.


## V1.2 TypeScript fix

Fixed the explicit typing of Supabase SSR cookie updates required by strict TypeScript builds on Vercel.
