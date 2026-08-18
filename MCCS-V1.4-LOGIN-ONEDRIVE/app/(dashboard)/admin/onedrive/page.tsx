import { getOneDriveConfigStatus } from "@/lib/microsoft/onedrive";

export default function OneDriveAdminPage() {
  const status = getOneDriveConfigStatus();

  return (
    <div>
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Administration
      </div>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">OneDrive Configuration</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        MCCS stores commercial files in Microsoft OneDrive through Microsoft Graph. Secrets are read only from Vercel server environment variables.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
          <div className={`mt-2 text-2xl font-bold ${status.configured ? "text-emerald-700" : "text-amber-700"}`}>
            {status.configured ? "Configured" : "Configuration required"}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drive ID</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {status.driveIdConfigured ? "Present" : "Missing"}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Root Folder</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{status.rootFolder}</div>
        </div>
      </div>

      {!status.configured ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">Missing Vercel server variables</h2>
          <div className="mt-3 space-y-1 text-sm text-amber-800">
            {status.missing.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Security model</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Microsoft client secrets must stay in Vercel server environment variables. They must never be committed to GitHub or exposed as NEXT_PUBLIC variables.
        </p>
      </div>
    </div>
  );
}
