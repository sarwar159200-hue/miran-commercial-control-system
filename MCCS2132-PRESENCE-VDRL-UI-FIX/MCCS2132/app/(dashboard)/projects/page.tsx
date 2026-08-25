import Link from "next/link";
import { deactivateProject, deleteProjectPackage } from "../_actions/commercial";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";

export const dynamic = "force-dynamic";

function projectDuration(start?: string | null, finish?: string | null) {
  if (!start || !finish) return null;
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${finish}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  const weeks = days / 7;
  const months = days / 30.4375;
  return { days, weeks, months };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; warning?: string; created?: string; updated?: string; deactivated?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle() : {data:null as any};
  const isSuperAdmin = Boolean(me?.is_super_admin || user?.email?.toLowerCase() === "sarwar.khalid@miranenergy.com");

  const result = await supabase
    .from("projects")
    .select("id,project_code,project_name,description,start_date,planned_finish_date,is_active,is_deleted,vendor_id,vendors(vendor_name)")
    .eq("is_deleted", false)
    .order("project_name");

  const rows = result.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Commercial Master Data
          </div>
          <h1 className="mt-2 text-3xl font-bold">Projects & Supply Packages</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create the commercial package under a Vendor / Contractor before creating POs, invoices and documents.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white"
        >
          Add Project / Package
        </Link>
      </div>

      {params.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}

      {params.warning ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Project / package was saved, but Google Drive reported: {params.warning}
        </div>
      ) : null}

      {params.created || params.updated || params.deactivated ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {params.created ? "Project / supply package created successfully." : params.updated ? "Project / supply package updated successfully." : "Project / supply package deactivated."}
        </div>
      ) : null}

      {result.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Projects could not be loaded: {result.error.message}
        </div>
      ) : null}

      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Project / Package</th>
              <th className="px-5 py-3">Vendor / Contractor</th>
              <th className="px-5 py-3">Start</th>
              <th className="px-5 py-3">Planned Finish</th>
              <th className="px-5 py-3">Calendar Duration</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-bold">{r.project_code}</td>
                <td className="px-5 py-4">{r.project_name}</td>
                <td className="px-5 py-4">{r.vendors?.vendor_name || "—"}</td>
                <td className="px-5 py-4">{r.start_date || "—"}</td>
                <td className="px-5 py-4">
                  <div>{r.planned_finish_date || "—"}</div>
                  {r.planned_finish_date ? <div className="mt-1 text-[11px] text-slate-400">Basis: planned finish date</div> : null}
                </td>
                <td className="px-5 py-4">
                  {(() => {
                    const d = projectDuration(r.start_date, r.planned_finish_date);
                    return d ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">{d.days.toLocaleString()} days</div>
                        <div className="text-xs text-slate-500">{d.weeks.toFixed(1)} weeks • {d.months.toFixed(1)} months</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>;
                  })()}
                </td>
                <td className="px-5 py-4">
                  {r.is_active ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Inactive</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex flex-wrap justify-end gap-3"><Link href={`/projects/${r.id}/edit`} className="text-sm font-bold text-blue-700">Edit</Link>{r.is_active ? <form action={deactivateProject}><input type="hidden" name="project_id" value={r.id}/><button className="text-sm font-bold text-amber-700">Deactivate</button></form>:null}{isSuperAdmin?<SuperAdminDelete entity="project" entityId={r.id} entityLabel={r.project_name} idField="project_id" action={deleteProjectPackage}/>:null}</div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                  No projects / supply packages yet. Create one to unlock the PO and document workflow.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
