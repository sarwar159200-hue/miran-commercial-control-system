import Link from "next/link";
import { createProject } from "../../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: vendors } = await supabase.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Package</div>
          <h1 className="mt-2 text-3xl font-bold">Create Project / Supply Package</h1>
          <p className="mt-2 text-sm text-slate-500">This becomes the main Google Drive folder under the selected vendor, e.g. Emerson → Supply PSV.</p>
        </div>
        <Link href="/admin/projects" className="text-sm font-bold text-blue-700">Back</Link>
      </div>

      {params.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{params.error}</div> : null}

      <form action={createProject} className="mccs-card mt-7 rounded-2xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Vendor / Contractor *">
            <select name="vendor_id" required className="input"><option value="">Select vendor</option>{(vendors??[]).map((v:any)=><option key={v.id} value={v.id}>{v.vendor_name}</option>)}</select>
          </Field>
          <Field label="Project / Package Code *"><input name="project_code" required className="input" placeholder="PSV-001" /></Field>
          <Field label="Project / Package Name *"><input name="project_name" required className="input" placeholder="Supply PSV" /></Field>
          <Field label="Start Date"><input name="start_date" type="date" className="input" /></Field>
          <Field label="Planned Finish Date"><input name="planned_finish_date" type="date" className="input" /></Field>
        </div>
        <Field label="Description"><textarea name="description" rows={4} className="input mt-5" /></Field>
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Google Drive structure created automatically: Vendor → Project/Package → PO / Invoice / SRF / Other Documents.</div>
        <div className="mt-7 flex justify-end"><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white">Create Project / Package</button></div>
      </form>
    </div>
  );
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>}
