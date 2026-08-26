import Link from "next/link";
import { Building2, Network, Plus, GitBranch, BriefcaseBusiness } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteVendorRecord } from "../_actions/commercial";
import SuperAdminDelete from "@/components/super-admin-delete";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle() : {data:null as any};
  const isSuperAdmin = Boolean(me?.is_super_admin || user?.email?.toLowerCase() === "sarwar.khalid@miranenergy.com");

  const vendorResult = await supabase
    .from("vendors")
    .select("id,vendor_code,vendor_name,relationship_type,parent_vendor_id,is_active,is_deleted")
    .eq("is_deleted", false)
    .order("vendor_name");
  const vendors = vendorResult.data ?? [];
  const names = new Map<string,string>(vendors.map((v: any) => [String(v.id), String(v.vendor_name ?? "—")]));

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Master Data</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Vendor Register</h1>
          <p className="mt-2 text-sm text-slate-500">Main vendors and sub-vendors are managed separately, then displayed together here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/vendors/main/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> Add Main Vendor
          </Link>
          <Link href="/vendors/subvendors/new" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800">
            <GitBranch className="h-4 w-4" /> Add Sub-Vendor
          </Link>
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            <BriefcaseBusiness className="h-4 w-4" /> Projects & Packages
          </Link>
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="mccs-card rounded-2xl p-5"><Building2 className="h-5 w-5 text-blue-700" /><div className="mt-3 text-3xl font-bold">{vendors.filter((v:any)=>!v.parent_vendor_id).length}</div><div className="mt-1 text-sm text-slate-500">Main vendors</div></div>
        <div className="mccs-card rounded-2xl p-5"><Network className="h-5 w-5 text-blue-700" /><div className="mt-3 text-3xl font-bold">{vendors.filter((v:any)=>v.parent_vendor_id).length}</div><div className="mt-1 text-sm text-slate-500">Sub-vendors</div></div>
        <div className="mccs-card rounded-2xl p-5"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Total</div><div className="mt-3 text-3xl font-bold">{vendors.length}</div><div className="mt-1 text-sm text-slate-500">Vendor records</div></div>
      </div>

      <div className="mccs-card mt-6 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Parent</th><th className="px-5 py-3">Relationship</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v:any)=>(
                <tr key={v.id} className="bg-white">
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{v.vendor_code || "—"}</td>
                  <td className="px-5 py-4 font-bold text-slate-900">{v.vendor_name}</td>
                  <td className="px-5 py-4 text-slate-600">{v.parent_vendor_id ? names.get(v.parent_vendor_id) || "—" : "—"}</td>
                  <td className="px-5 py-4 capitalize text-slate-600">{String(v.relationship_type).replaceAll("_"," ")}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{v.is_active ? "Active" : "Inactive"}</span></td><td className="px-5 py-4"><div className="flex gap-3"><Link href={`/vendors/${v.id}/edit`} className="font-bold text-blue-700">Edit</Link>{isSuperAdmin?<SuperAdminDelete entity="vendor" entityId={v.id} entityLabel={v.vendor_name} idField="vendor_id" action={deleteVendorRecord}/>:null}</div></td>
                </tr>
              ))}
              {!vendors.length ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No vendors yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
