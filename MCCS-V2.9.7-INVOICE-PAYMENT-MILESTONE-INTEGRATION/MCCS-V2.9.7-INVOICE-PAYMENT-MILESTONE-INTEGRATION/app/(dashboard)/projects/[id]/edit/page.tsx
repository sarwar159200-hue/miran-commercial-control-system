import Link from "next/link";
import { updateProject } from "../../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const r = await s
    .from("projects")
    .select("*,vendors(vendor_name)")
    .eq("id", id)
    .maybeSingle();
  const x: any = r.data;
  if (!x) return <div>Project / package not found.</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Master Data</div>
          <h1 className="mt-2 text-3xl font-bold">Edit Project / Supply Package</h1>
          <p className="mt-2 text-sm text-slate-500">Vendor / Contractor: <strong>{x.vendors?.vendor_name || "—"}</strong></p>
        </div>
        <Link href="/projects" className="font-bold text-blue-700">Back</Link>
      </div>

      {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{q.error}</div> : null}

      <form action={updateProject} className="mccs-card mt-7 rounded-2xl p-6">
        <input type="hidden" name="project_id" value={id} />
        <div className="grid gap-5 md:grid-cols-2">
          <F l="Project / Package Code *"><input name="project_code" defaultValue={x.project_code || ""} required className="input" /></F>
          <F l="Project / Package Name *"><input name="project_name" defaultValue={x.project_name || ""} required className="input" /></F>
          <F l="Start Date"><input name="start_date" type="date" defaultValue={x.start_date || ""} className="input" /></F>
          <F l="Planned Finish"><input name="planned_finish_date" type="date" defaultValue={x.planned_finish_date || ""} className="input" /></F>
        </div>
        <label className="mt-5 flex items-center gap-3"><input type="checkbox" name="is_active" defaultChecked={!!x.is_active} /> Active project / package</label>
        <F l="Description"><textarea name="description" defaultValue={x.description || ""} rows={4} className="input mt-5" /></F>
        <div className="mt-7 flex justify-end"><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600">Save Project / Package</button></div>
      </form>
    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{l}</span>{children}</label>;
}
