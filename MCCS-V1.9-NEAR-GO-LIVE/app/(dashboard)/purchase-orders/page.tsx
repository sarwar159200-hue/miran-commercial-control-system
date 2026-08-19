import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: pos = [] } = await supabase
    .from("purchase_orders")
    .select("id,po_number,po_date,current_value,status,is_historical,vendors(vendor_name),currencies(code)")
    .order("po_date", { ascending: false });

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Commitments</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Purchase Orders</h1>
          <p className="mt-2 text-sm text-slate-500">New, approved and historical PO register.</p>
        </div>
        <Link href="/purchase-orders/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">
          <FilePlus2 className="h-4 w-4" /> New Purchase Order
        </Link>
      </div>

      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">PO Date</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pos || []).map((po: any) => (
                <tr key={po.id} className="bg-white">
                  <td className="px-5 py-4 font-bold text-slate-900">{po.po_number}</td>
                  <td className="px-5 py-4 text-slate-600">{po.vendors?.vendor_name || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{po.po_date}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {po.currencies?.code || ""} {Number(po.current_value || 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-600">{po.status}</td>
                  <td className="px-5 py-4">{po.is_historical ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Historical</span> : "—"}</td>
                </tr>
              ))}
              {!pos.length ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No purchase orders yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
