import Link from "next/link";
import { Building2, Network, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: vendors = [] } = await supabase
    .from("vendors")
    .select("id,vendor_code,vendor_name,relationship_type,parent_vendor_id,is_active")
    .order("vendor_name");

  const map = new Map((vendors || []).map((v: any) => [v.id, v.vendor_name]));

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Master Data</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Vendors & Sub-Vendors</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create unlimited vendor hierarchy such as ILF → Emerson, without example text in the working register.
          </p>
        </div>
        <Link href="/vendors/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Add Vendor
        </Link>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="mccs-card rounded-2xl p-5">
          <Building2 className="h-5 w-5 text-blue-700" />
          <div className="mt-3 text-3xl font-bold">{vendors.length}</div>
          <div className="mt-1 text-sm text-slate-500">Total vendors</div>
        </div>
        <div className="mccs-card rounded-2xl p-5">
          <Network className="h-5 w-5 text-blue-700" />
          <div className="mt-3 text-3xl font-bold">
            {vendors.filter((v: any) => v.parent_vendor_id).length}
          </div>
          <div className="mt-1 text-sm text-slate-500">Sub-vendors</div>
        </div>
      </div>

      <div className="mccs-card mt-6 overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-950">Vendor Register</h2>
        </div>
        {vendors.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Parent Vendor</th>
                  <th className="px-5 py-3">Relationship</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((v: any) => (
                  <tr key={v.id} className="bg-white">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{v.vendor_code || "—"}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">{v.vendor_name}</td>
                    <td className="px-5 py-4 text-slate-600">{v.parent_vendor_id ? map.get(v.parent_vendor_id) || "—" : "—"}</td>
                    <td className="px-5 py-4 capitalize text-slate-600">{String(v.relationship_type).replaceAll("_"," ")}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">No vendors have been added yet.</div>
        )}
      </div>
    </div>
  );
}
