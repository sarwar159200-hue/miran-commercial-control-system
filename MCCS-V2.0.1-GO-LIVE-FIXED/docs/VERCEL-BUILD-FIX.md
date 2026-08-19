# MCCS V1.1 — Vercel Build Fix

This package updates the application from Next.js 15.2.4 to **Next.js 15.5.21**.

Why:
- The original V1 package used Next.js 15.2.4.
- That release line is affected by later disclosed Next.js / React Server Components security issues.
- Vercel blocks certain vulnerable Next.js deployments by default.
- Next.js 15.5.21 is the July 2026 Maintenance LTS security release.

## Supabase environment variables

In Vercel add:

1. `NEXT_PUBLIC_SUPABASE_URL`
   - Example: `https://your-project-ref.supabase.co`

2. Prefer:
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   The code also accepts the older:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not put the Supabase service-role/secret key in a `NEXT_PUBLIC_` variable.

## GitHub replacement instructions

Inside your repository's `MCCS-V1` folder:
- Replace `package.json`
- Replace `lib/supabase/client.ts`
- Replace `lib/supabase/server.ts`
- Replace `.env.example` if it is visible in your upload workflow

Simplest option:
Delete the old `MCCS-V1` folder in GitHub and upload the full contents of this fixed package as `MCCS-V1`.

Then redeploy in Vercel with Root Directory still set to:
`MCCS-V1`
