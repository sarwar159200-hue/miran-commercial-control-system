# MCCS V2.6.3 — Root Upload Ready / TypeScript Build Fix

This build fixes strict Next.js/TypeScript ReactNode inference in the Documents register and related Map typing.

# MCCS V2.6.2 — Root Upload Ready

Miran Commercial Control System with Google Drive document storage and vendor/project commercial hierarchy.

## Commercial document hierarchy

```
Vendor / Contractor
└── Project / Supply Package
    ├── PO
    │   └── PO Number
    │       ├── Purchase Order PDF
    │       ├── Technical Offer
    │       └── Supporting Documents
    ├── Invoice
    │   └── Invoice Number
    │       ├── Invoice File
    │       └── Supporting Documents
    ├── SRF
    └── Other Documents
```

The application is designed to register document metadata in Supabase and store physical files in Google Drive.

## Important deployment rule

This ZIP is prepared so its files go **directly into the GitHub repository root**. Do not create a folder such as `MCCS-V2.6.2-...` inside the repository.

In Vercel, leave **Root Directory empty**.

See `docs/DEPLOYMENT.md` for the exact deployment steps.
