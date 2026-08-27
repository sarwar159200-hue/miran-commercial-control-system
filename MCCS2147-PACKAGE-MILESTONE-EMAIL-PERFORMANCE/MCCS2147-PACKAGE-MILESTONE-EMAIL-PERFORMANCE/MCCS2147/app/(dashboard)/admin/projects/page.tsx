import Link from "next/link";
import { deactivateProject } from "../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  const result = await supabase
    .from("projects")
    .select("id,project_code,project_name,description,start_date,planned_finish_date,is_active")
    .order("project_name");

  const rows = result.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Administration
          </div>
          <h1 className="mt-2 text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-sm text-slate-500">
            Project master used by Purchase Orders and commercial reporting.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white"
        >
          Add Project
        </Link>
      </div>

      {params.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {params.error}
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
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Start</th>
              <th className="px-5 py-3">Planned Finish</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-bold">{r.project_code}</td>
                <td className="px-5 py-4">{r.project_name}</td>
                <td className="px-5 py-4">{r.start_date || "—"}</td>
                <td className="px-5 py-4">{r.planned_finish_date || "—"}</td>
                <td className="px-5 py-4">
                  {r.is_active ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Inactive</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-3"><Link href={`/admin/projects/${r.id}/edit`} className="text-sm font-bold text-blue-700">Edit</Link>{r.is_active ? (
                    <form action={deactivateProject}>
                      <input type="hidden" name="project_id" value={r.id} />
                      <button className="text-sm font-bold text-red-600">Deactivate</button>
                    </form>
                  ) : null}</div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  No projects yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
