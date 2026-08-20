import { getOneDriveConfigStatus } from "@/lib/microsoft/onedrive";
import { StorageControl } from "./storage-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OneDriveAdminPage() {
  const status = getOneDriveConfigStatus();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Administration
      </div>
      <h1 className="mt-1 text-3xl font-bold">Microsoft Storage</h1>
      <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
        MCCS can store commercial documents in a configured Microsoft OneDrive or SharePoint document library through Microsoft Graph.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <Card label="Configuration" value={status.configured ? "Ready" : "Required"} />
        <Card label="Drive ID" value={status.driveIdConfigured ? "Present" : "Missing"} />
        <Card label="Root Folder" value={status.rootFolder} />
      </div>

      {!status.configured ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:bg-amber-950/20">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            Missing Vercel server variables
          </h2>
          <div className="mt-3 space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {status.missing.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      ) : null}

      <StorageControl />

      <div className="mccs-card mt-6 rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Recommended folder structure</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
{`MCCS/
├── Projects/
├── Purchase Orders/
├── Invoices/
├── Payments/
├── Vendors/
├── Supporting Documents/
└── Historical/`}
        </pre>
      </div>

      <div className="mccs-card mt-6 rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Tenant ID, Client ID, Client Secret and Drive ID remain server-only Vercel variables.
          The Microsoft client secret must never be committed to GitHub or exposed as a NEXT_PUBLIC variable.
        </p>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="mccs-card rounded-2xl p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
