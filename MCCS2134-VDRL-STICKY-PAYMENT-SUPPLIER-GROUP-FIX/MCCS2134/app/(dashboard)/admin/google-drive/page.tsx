import Link from "next/link";
import { requireSuperAdmin } from "@/lib/mccs/auth";
import { getGoogleDriveConnectionStatus } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  await requireSuperAdmin();
  const q = await searchParams;
  const status = await getGoogleDriveConnectionStatus();
  return <div className="mx-auto max-w-5xl">
    <div className="flex items-end justify-between gap-4"><div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Administration</div><h1 className="mt-2 text-3xl font-bold">Google Drive Configuration</h1><p className="mt-2 text-sm text-slate-500">Secure MCCS document storage using the configured Google Drive account.</p></div><Link href="/admin" className="font-bold text-blue-700">Back</Link></div>
    {q.connected ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Google Drive connected successfully.</div> : null}
    {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div> : null}
    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <Card label="Environment" value={status.configured ? "Configured" : "Configuration required"} />
      <Card label="Authorization" value={status.connected ? "Connected" : "Not connected"} />
      <Card label="Root Folder" value={status.folderName || (status.rootFolderId ? "Folder ID configured" : "Missing")} />
    </div>
    {!status.configured ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Missing Vercel variables: <b>{status.missing.join(", ")}</b></div> : null}
    <section className="mccs-card mt-6 rounded-2xl p-6"><h2 className="text-lg font-bold">Google Drive authorization</h2><p className="mt-2 text-sm text-slate-500">Only a Super Admin should connect the storage account. MCCS requests the restricted <code>drive.file</code> scope.</p><a href="/api/auth/google/" className="mt-5 inline-flex rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600">{status.connected ? "Reconnect Google Drive" : "Connect Google Drive"}</a></section>
  </div>;
}
function Card({label,value}:{label:string;value:string}){return <div className="mccs-card rounded-2xl p-5"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>}
